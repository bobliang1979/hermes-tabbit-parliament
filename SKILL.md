---
name: tabbit-5-model-collaboration
description: >-
  🧠 Hermes 驱动的 5 模型议会协作——核心工作流。
  Hermes 作为大脑，每次思考后决定问哪个模型，
  读回复后思考再决定下一步。不是固定管线，是交互式推理。
version: "6.0.0"
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [tabbit, multi-model, cdp, hermes-brain, interactive, parliament, workflow]
    homepage: "https://github.com/D4Vinci/Scrapling"
  openclaw:
    emoji: "🧠"
    requires:
      bins:
        - node
---

# 🧠 Hermes 驱动的 5 模型议会协作（v6）

## 核心哲学

**不是固定管线。是 Hermes 每一步思考后决定。**

```
❌ 错误方式: 写一个 parliament.js 脚本自动跑 5 个模型
✅ 正确方式: Hermes 自己决定每个步骤问哪个模型，读回复后思考再下一步
```

## Hermes 的思考循环

每次任务，Hermes 遵循以下循环：

```
1. 🧠 Hermes 分析任务
   "这个任务需要什么信息？谁最擅长这个？"
   
2. 📤 Hermes 向模型提问
   node hermes-tools.js ask <模型> "<问题>"
   
3. 📖 Hermes 读回复
   "回复说了什么？有什么新发现？"
   
4. 🤔 Hermes 思考
   "这个答案够了吗？需要问另一个模型吗？"
   "有什么错误需要纠正？"
   
5. 🔄 根据思考决定下一步
   要么问另一个模型 → 回到步骤2
   要么完成任务 → 输出结果
```

## 5 个模型的用途（Hermes 的决策依据）

| 模型 | 特长 | Hermes 什么时候用它 |
|------|------|-------------------|
| 🔍 **Grok** | 搜索最新信息 | 需要查资料、找库、纠正错误假设时 |
| 💬 **千问** | 设计方案、写代码 | 需要架构方案、技术实现时 |
| 🤝 **Arena Sonnet** | 找漏洞、挑刺 | 有了方案后，需要人"唱反调"找问题 |
| 🧠 **Gemini** | 综合分析、决策 | 有多方观点时，需要议长做最终决策 |
| ✍️ **清言** | 写完整代码 | 所有讨论完成后，执笔最终实现 |

## 工作流模式库

### 模式 A: 议会全流程（复杂任务）

```
Hermes: "这个任务复杂，走全流程"

Step 1: 🔍 ask Grok "搜索技术细节..."
  → Hermes读回复 → 发现关键信息
Step 2: 💬 ask 千问 "基于Grok的结果设计方案..."
  → Hermes读回复 → 获取架构方案
Step 3: 🤝 ask Arena "审查千问的方案..."
  → Hermes读回复 → 发现漏洞
Step 4: 🧠 ask Gemini "综合三方意见做决策..."
  → Hermes读回复 → 获得最终决策
Step 5: ✍️ ask 清言 "根据全部讨论写代码..."
  → Hermes读回复 → 获得代码
Step 6: Hermes自己验证 → 输出最终结果
```

### 模式 B: 快速验证（中等任务）

```
Hermes: "这个任务需要先设计方案再看有没有问题"

Step 1: 💬 ask 千问 "设计方案..."
Step 2: 🤝 ask Arena "审查方案..."
Step 3: 🧠 Hermes自己综合 → 输出
```

### 模式 C: 直接写代码（简单任务）

```
Hermes: "这个很简单，不用议会"

Step 1: 💬 ask 千问 "直接写代码..."
Step 2: 🧠 Hermes自己验证 → 输出
```

### 模式 D: 搜索+实现（需要查资料）

```
Hermes: "需要先查资料再实现"

Step 1: 🔍 ask Grok "搜索..."
Step 2: 💬 ask 千问 "根据搜索实现..."
Step 3: 🧠 Hermes验证 → 输出
```

## 关键原则

1. **Hermes 决定每一步** — 不是脚本决定的，是 Hermes 读完回复后现场思考
2. **可以跳过不需要的模型** — 简单任务只问千问就够了
3. **可以纠正错误方向** — 如果 Grok 发现之前假设错了，立刻调整
4. **每个模型只做它最擅长的** — 不让千问去搜索，不让 Grok 写代码
5. **Hermes 始终是最终决策者** — 模型是工具，不是议会的议员

## 工具文件

- `~/Desktop/hermes-tools.js` — 向模型提问和读取回复的工具
  - `node hermes-tools.js ask 千问 "提示"` — 发送并读取
  - `node hermes-tools.js list` — 查看在线模型
  - `node hermes-tools.js read 千问` — 读取当前页面内容
  - `node hermes-tools.js new 千问` — 新建对话

## 真实案例: Fable-5 Agent 设计

完整交互记录见 `references/fable5-case-study.md`
