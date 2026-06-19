"""
Fable-5 Agent — 主引擎
基于议会辩论最终决策实现:
- 4层架构: API → LangGraph状态机 → vLLM+xgrammar → gVisor沙箱
- XML: <think> / <tool_use><tool_name> / <tool_result is_error=>
- vLLM: max_model_len=8192, temperature=0.2, gpu_mem=0.85
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("fable5_agent")


# ═══════════════════════════════════════════════════════════════
# 1. Fable-5 XML Parser（基于Grok纠正后的格式）
# ═══════════════════════════════════════════════════════════════

@dataclass
class Fable5Action:
    """解析后的Fable-5动作。"""
    type: str  # "think" | "tool_call" | "final"
    content: str = ""
    tool_name: str = ""
    tool_params: dict[str, Any] = field(default_factory=dict)
    raw: str = ""


class Fable5Parser:
    """Fable-5 XML流解析器。
    
    支持格式:
      <think>推理</think>
      <tool_use><tool_name>名</tool_name><parameters>...</parameters></tool_use>
      <tool_result is_error="true|false">结果</tool_result>
    """

    THINK_RE = re.compile(r"<think>(.*?)</think>", re.DOTALL)
    TOOL_USE_RE = re.compile(
        r"<tool_use>\s*<tool_name>(.*?)</tool_name>\s*<parameters>(.*?)</parameters>\s*</tool_use>",
        re.DOTALL,
    )
    TOOL_RESULT_RE = re.compile(
        r'<tool_result(?:\s+is_error="(true|false)")?>(.*?)</tool_result>',
        re.DOTALL,
    )

    def parse_stream(self, text: str) -> list[Fable5Action]:
        """解析模型输出，返回动作列表。"""
        actions = []

        # Thinking
        for match in self.THINK_RE.finditer(text):
            actions.append(Fable5Action(
                type="think", content=match.group(1).strip(), raw=match.group(0),
            ))

        # Tool calls
        for match in self.TOOL_USE_RE.finditer(text):
            params = self._parse_params(match.group(2))
            actions.append(Fable5Action(
                type="tool_call",
                tool_name=match.group(1).strip(),
                tool_params=params,
                raw=match.group(0),
            ))

        # Tool results (通常由系统注入)
        for match in self.TOOL_RESULT_RE.finditer(text):
            actions.append(Fable5Action(
                type="tool_result",
                content=match.group(2).strip(),
                raw=match.group(0),
            ))

        # Final answer: 无标签的纯文本
        cleaned = self.THINK_RE.sub("", text)
        cleaned = self.TOOL_USE_RE.sub("", cleaned)
        cleaned = self.TOOL_RESULT_RE.sub("", cleaned)
        cleaned = cleaned.strip()
        if cleaned:
            actions.append(Fable5Action(type="final", content=cleaned))

        return actions

    def _parse_params(self, xml_fragment: str) -> dict[str, Any]:
        """从XML片段中提取参数键值对。"""
        params = {}
        for match in re.finditer(r"<(\w+)>(.*?)</\1>", xml_fragment, re.DOTALL):
            key = match.group(1)
            value = match.group(2).strip()
            # 尝试JSON解析
            try:
                params[key] = json.loads(value)
            except (json.JSONDecodeError, ValueError):
                params[key] = value
        return params

    def format_tool_result(self, tool_name: str, result: str, is_error: bool = False) -> str:
        error_attr = ' is_error="true"' if is_error else ""
        return f"<tool_result{error_attr}>\n{tool_name} returned:\n{result}\n</tool_result>"

    def format_system_prompt(self, tools_desc: str) -> str:
        return f"""You are a Fable-5 agentic coding assistant running on Qwable-v1.

AVAILABLE TOOLS:
{tools_desc}

OUTPUT FORMAT:
When you need to reason, output:
<think>Your reasoning here</think>

When you need to use a tool, output:
<tool_use>
<tool_name>tool_name</tool_name>
<parameters>
<param1_name>value1</param1_name>
<param2_name>value2</param2_name>
</parameters>
</tool_use>

When you have the final answer, output it directly without any tags.

RULES:
- Always think before using a tool
- Use tools when you need information or to perform actions
- Never make up tool results — wait for the actual result
- Be precise with parameters
- If a tool fails, try an alternative approach"""


# ═══════════════════════════════════════════════════════════════
# 2. Tool Registry（Arena建议：沙箱隔离）
# ═══════════════════════════════════════════════════════════════

class SandboxedTool:
    """沙箱隔离的工具执行。Arena建议通过RPC发给gVisor容器。"""

    def __init__(self, sandbox_endpoint: str = "http://localhost:9001/run"):
        self.endpoint = sandbox_endpoint

    async def execute(self, tool_name: str, **params) -> str:
        """通过RPC在隔离沙箱中执行工具。"""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.endpoint, json={
                    "tool": tool_name,
                    "args": params,
                })
                return resp.text
        except Exception as e:
            return f"Sandbox Error: {e}"


# ═══════════════════════════════════════════════════════════════
# 3. 主Agent循环（Gemini决策：LangGraph风格状态机）
# ═══════════════════════════════════════════════════════════════

class Fable5Agent:
    """Fable-5 Agent 主引擎。
    
    状态转移:
    IDLE → THINKING (LLM生成<think>)
         → TOOL_CALL (LLM生成<tool_use>)
         → EXECUTING (沙箱执行工具)
         → FEEDBACK (注入<tool_result>)
         → THINKING (LLM继续推理)
         → FINAL (LLM给出最终答案)
    
    支持推理后端:
      - vllm: 生产部署 (默认, 需要本地vLLM)
      - deepseek: 开发测试 (直接用DeepSeek API)
    """

    def __init__(
        self,
        llm_endpoint: str = "http://localhost:8000/v1/chat/completions",
        sandbox_endpoint: str = "http://localhost:9001/run",
        max_steps: int = 25,
        model: str = "lordx64/Qwable-v1",
        temperature: float = 0.2,
        backend: str = "auto",  # "auto" | "vllm" | "deepseek"
    ):
        self.llm_endpoint = llm_endpoint
        self.parser = Fable5Parser()
        self.sandbox = SandboxedTool(sandbox_endpoint)
        self.max_steps = max_steps
        self.model = model
        self.temperature = temperature
        self.backend = backend

    async def run(self, user_input: str, tools_desc: str = "") -> dict[str, Any]:
        """运行Fable-5 Agent循环。"""
        system_prompt = self.parser.format_system_prompt(tools_desc or "No tools available.")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]
        step = 0
        tool_history = []
        think_history = []

        while step < self.max_steps:
            step += 1
            logger.info("Step %d/%d", step, self.max_steps)

            # 1. LLM推理
            raw_output = await self._call_llm(messages)
            if not raw_output:
                break

            # 2. 解析
            actions = self.parser.parse_stream(raw_output)

            has_tool_call = False
            final_answer = ""

            for action in actions:
                if action.type == "think":
                    think_history.append(action.content)
                    logger.info("🧠 Think: %s", action.content[:100])

                elif action.type == "tool_call":
                    has_tool_call = True
                    logger.info("🔧 Tool: %s %s", action.tool_name, action.tool_params)

                    # 通过沙箱执行
                    result = await self.sandbox.execute(
                        action.tool_name, **action.tool_params,
                    )

                    # 注入工具结果
                    tool_result_xml = self.parser.format_tool_result(
                        action.tool_name, result,
                    )
                    messages.append({"role": "assistant", "content": action.raw})
                    messages.append({"role": "user", "content": tool_result_xml})
                    tool_history.append({
                        "tool": action.tool_name,
                        "params": action.tool_params,
                        "result": result[:300],
                    })

                elif action.type == "final":
                    final_answer = action.content

            if not has_tool_call:
                # Final answer
                return {
                    "answer": final_answer or raw_output,
                    "thinking": think_history,
                    "tool_calls": tool_history,
                    "steps": step,
                }

        return {
            "answer": "Max steps exceeded.",
            "thinking": think_history,
            "tool_calls": tool_history,
            "steps": step,
            "error": "max_steps_exceeded",
        }

    async def _call_llm(self, messages: list[dict]) -> str:
        """调用LLM推理端点。支持vLLM和DeepSeek后端。"""
        # 自动检测后端
        backend = self.backend
        if backend == "auto":
            # 检查DeepSeek API key是否存在
            import os
            if os.getenv("DEEPSEEK_API_KEY"):
                backend = "deepseek"
            else:
                backend = "vllm"

        if backend == "deepseek":
            return await self._call_deepseek(messages)
        
        # vLLM生产模式
        import httpx
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": 4096,
            "stop": ["</tool_use>", "</tool_result>"],
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(self.llm_endpoint, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            return ""

    async def _call_deepseek(self, messages: list[dict]) -> str:
        """用DeepSeek API开发测试。"""
        import os, json, urllib.request
        key = os.getenv("DEEPSEEK_API_KEY", "")
        if not key:
            env_path = os.path.expanduser("~/AppData/Local/hermes/.env")
            if os.path.exists(env_path):
                with open(env_path) as f:
                    for line in f:
                        if line.startswith("DEEPSEEK_API_KEY"):
                            key = line.split("=", 1)[1].strip()
                            break
        
        # 构建Fable-5风格的prompt
        payload = json.dumps({
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "你是一个Fable-5 agent。输出格式：<think>推理</think> 然后 <tool_use><tool_name>工具名</tool_name><parameters>...</parameters></tool_use> 或直接输出答案。"},
                {"role": "user", "content": messages[-1]["content"]}
            ],
            "temperature": self.temperature,
            "max_tokens": 2048,
        }).encode()
        
        req = urllib.request.Request(
            "https://api.deepseek.com/chat/completions", data=payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
        )
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error("DeepSeek call failed: %s", e)
            return ""


# ═══════════════════════════════════════════════════════════════
# 4. 快速测试
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import asyncio

    # 测试Parser
    parser = Fable5Parser()
    sample = """<think>I need to search for the user's query.</think>
<tool_use>
<tool_name>web_search</tool_name>
<parameters>
<query>Python asyncio</query>
<max_results>5</max_results>
</parameters>
</tool_use>
<tool_result>
web_search returned: result1, result2
</tool_result>
<think>Now I have the results.</think>
Here is the final answer."""

    actions = parser.parse_stream(sample)
    print("=== Parser Test ===")
    for a in actions:
        print(f"  {a.type}: {a.content[:60] if a.content else a.tool_name}")
    print()

    # 测试格式化
    print("=== Format Tool Result ===")
    print(parser.format_tool_result("web_search", '{"results": ["a", "b"]}'))
    print()

    print("Agent engine ready. Deploy with: python fable5_server.py")
