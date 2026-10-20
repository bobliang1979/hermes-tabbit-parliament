---
name: tabbit-5-model-collaboration
description: >-
  🧠 Hermes 驱动的 5 模型议会协作——核心工作流。
  Hermes 作为大脑，每次思考后决定问哪个模型，
  读回复后思考再决定下一步。不是固定管线，是交互式推理。
version: "7.0.0"
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [tabbit, multi-model, cdp, hermes-brain, interactive, parliament, workflow]
    homepage: "https://github.com/bobliang1979/hermes-tabbit-parliament"
  openclaw:
    emoji: "🧠"
    requires:
      bins:
        - node
---

# 🧠 Hermes 驱动的 5 模型议会协作（v7）

## 核心哲学

**不是固定管线。是 Hermes 每一步思考后决定。**

```
❌ 错误方式: 写一个 parliament.js 脚本自动跑 5 个模型
✅ 正确方式: Hermes 自己决定每个步骤问哪个模型，读回复后思考再下一步
```

## Hermes 的思考循环

```
1. 🧠 Hermes 分析任务
   "这个任务需要什么信息？谁最擅长这个？"

2. 📤 Hermes 向模型提问
   node tools/hermes-tools.js ask <模型> "<问题>"

3. 📖 Hermes 读回复（stdout 就是答案，日志在 stderr）
   "回复说了什么？有什么新发现？"

4. 🤔 Hermes 思考
   "这个答案够了吗？需要问另一个模型吗？"
   "有什么错误需要纠正？"

5. 🔄 根据思考决定下一步
   要么问另一个模型 → 回到步骤2
   要么完成任务 → 输出结果
```

## 工具（在仓库根目录执行）

```bash
node tools/hermes-tools.js models          # 模型注册表 + 别名
node tools/hermes-tools.js list            # 在线标签页与角色
node tools/hermes-tools.js doctor          # 连接体检（先跑这个）
node tools/hermes-tools.js ask <模型> "<提示>"   # 新建对话 → 发送 → 等稳定 → 读回复
node tools/hermes-tools.js read <模型>     # 读取当前页面
node tools/hermes-tools.js new <模型>      # 仅新建对话
```

常用选项：`--json`（结构化输出）、`--timeout 300`、`--stable 2`、`--no-new`（继续当前会话）、`--tail N`、`--out <dir>`、`--no-save`、`-`（从 stdin 读提示词）。

退出码：`0` 成功 · `2` 用法错误 · `3` 未找到模型 · `4` CDP 不可达 · `5` 超时/无回复。
Hermes 应当根据退出码决定重试、换模型还是报错。

## 5 个模型的用途（Hermes 的决策依据）

| 模型 | 别名 | 特长 | Hermes 什么时候用它 |
|------|------|------|-------------------|
| 🔍 **Grok** | `grok`, `研究员` | 搜索最新信息 | 需要查资料、找库、纠正错误假设时 |
| 💬 **千问** | `qwen`, `千问`, `通义` | 设计方案、写代码 | 需要架构方案、技术实现时 |
| 🤝 **Arena Sonnet** | `arena`, `评审官` | 找漏洞、挑刺 | 有了方案后，需要人"唱反调"找问题 |
| 🧠 **Gemini** | `gemini`, `议长` | 综合分析、决策 | 有多方观点时，需要议长做最终决策 |
| ✍️ **清言** | `chatglm`, `清言`, `智谱` | 写完整代码 | 所有讨论完成后，执笔最终实现 |

## 工作流模式库

### 模式 A: 议会全流程（复杂任务）

```
Hermes: "这个任务复杂，走全流程"

Step 1: 🔍 ask grok   "搜索技术细节..."
  → Hermes读回复 → 发现关键信息
Step 2: 💬 ask 千问   "基于Grok的结果设计方案..."
  → Hermes读回复 → 获取架构方案
Step 3: 🤝 ask arena  "审查千问的方案..."
  → Hermes读回复 → 发现漏洞
Step 4: 🧠 ask gemini "综合三方意见做决策..."
  → Hermes读回复 → 获得最终决策
Step 5: ✍️ ask 清言   "根据全部讨论写代码..."
  → Hermes读回复 → 获得代码
Step 6: Hermes自己验证 → 输出最终结果
```

### 模式 B: 快速验证（中等任务）

```
Step 1: 💬 ask 千问 "设计方案..."
Step 2: 🤝 ask arena "审查方案..."
Step 3: 🧠 Hermes自己综合 → 输出
```

### 模式 C: 直接写代码（简单任务）

```
Step 1: 💬 ask 千问 "直接写代码..."
Step 2: 🧠 Hermes自己验证 → 输出
```

### 模式 D: 搜索+实现（需要查资料）

```
Step 1: 🔍 ask grok "搜索..."
Step 2: 💬 ask 千问 "根据搜索实现..."
Step 3: 🧠 Hermes验证 → 输出
```

## 关键原则

1. **Hermes 决定每一步** — 不是脚本决定的，是 Hermes 读完回复后现场思考
2. **可以跳过不需要的模型** — 简单任务只问千问就够了
3. **可以纠正错误方向** — 如果 Grok 发现之前假设错了，立刻调整
4. **每个模型只做它最擅长的** — 不让千问去搜索，不让 Grok 写代码
5. **Hermes 始终是最终决策者** — 模型是工具，不是议会的议员
6. **先 doctor 再提问** — 连接不通时退出码是 4，不要盲目重试

## 上下文隔离

默认每次 `ask` 都会先点击该模型的"新建对话"，避免历史污染。
需要模型看到自己上一轮时，加 `--no-new`。

## 真实案例: Fable-5 Agent 设计

完整交互记录见 [references/fable5-case-study.md](references/fable5-case-study.md)。
产出代码见仓库 `tools/fable5_agent.py` 与 `tools/fable5_server.py`。

## 参考资料

- [references/cdp-technical-details.md](references/cdp-technical-details.md) — CDP 细节与各模型 UI 差异
- [references/hermes-workflow.md](references/hermes-workflow.md) — Hermes 交互式决策流
- [references/parliament-legacy.md](references/parliament-legacy.md) — v4 固定管线（历史参考）
- [references/orchestrator-legacy.md](references/orchestrator-legacy.md) — v3 编排器（历史参考）
