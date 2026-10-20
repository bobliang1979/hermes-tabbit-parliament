# Fable-5 Agent 设计 — 真实议会交互记录

## 任务
设计基于 Qwable-v1 (Claude Fable-5 蒸馏) 的 Agent 系统

## 交互过程

### Step 1: Hermes → Grok
**Hermes**: "先搜索技术细节"
**Grok 回复**: 6964 chars
**关键发现**: Fable-5 的 XML 格式是 `<think>` 和 `<tool_use>`，
不是我之前假设的 `<thinking>` 和 `<call:tool_name>` ❗
**Hermes 决策**: "格式错了！先纠正再问下一个"

### Step 2: Hermes → 千问
**Hermes**: "基于纠正后的 XML 格式设计架构"
**千问回复**: 4层架构图:
  - Interface Layer (WebSocket/SSE)
  - Orchestration Layer (LangGraph)
  - Inference Layer (vLLM + GBNF)
  - Tool Execution Layer (沙箱)

### Step 3: Hermes → Arena
**Hermes**: "审查千问的架构，找漏洞"
**Arena 回复**: 2846 chars
**关键发现**:
  - P0: 工具执行需要 gVisor 沙箱隔离
  - P0: vLLM OOM 风险 (GGUF 19GB + KV Cache > 40GB)
  - P1: GBNF Grammar 表达能力不足，建议 xgrammar
**Hermes 决策**: "这些漏洞很严重，让 Gemini 做最终决策"

### Step 4: Hermes → Gemini
**Hermes**: "综合三方意见做架构决策"
**Gemini 回复**: 13409 chars
**决策**:
  - 采纳 Arena 的沙箱建议
  - 采纳 Arena 的 vLLM 配置限制
  - 采用 xgrammar 替代纯 GBNF
  - 给出 parse_action() / dispatch_sandbox() 代码骨架
  - Phase 1-2 实施路线图

### Step 5: Hermes → 清言
**Hermes**: "根据所有讨论写最终代码"
**清言回复**: 25149 chars (含完整 Python 代码)

### Step 6: Hermes 自己写最终文件
基于所有议会知识，输出:
  - fable5_agent.py (376行) — Agent 引擎
  - fable5_server.py (116行) — FastAPI 服务器

## 关键洞察
- Grok 纠正了 XML 格式错误（不问他就会用错的格式写代码）
- Arena 发现了架构中的安全漏洞（千问没考虑到）
- 每个模型都做了它最擅长的事
- Hermes 全程控制节奏和方向
