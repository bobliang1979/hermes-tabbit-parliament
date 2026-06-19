# Hermes 交互式议会工作流

这是 Hermes 驱动的 5 模型议会协作的核心工作流。

## 三部曲

每次任务都遵循:

```
Step 1: 🧠 Hermes 思考
  "这个任务需要什么？谁最适合回答这个问题？"

Step 2: 📤 Hermes 委派
  node hermes-tools.js ask Gemini "分析..."
  → Hermes 读取回复
  → Hermes 思考: "这个回复怎么样？够了吗？"
  
Step 3: 🔄 Hermes 迭代
  → "还需要 Grok 搜索一下"
  → node hermes-tools.js ask Grok "搜索..."
  → "再看看千问的实现"
  → node hermes-tools.js ask 千问 "实现..."
  → "让 Arena 审查"
  → node hermes-tools.js ask Arena "审查..."
  → "最后让清言润色"
  → node hermes-tools.js ask 清言 "最终版本"
```

## Hermes 的决策树

```
收到任务
  ↓
🤔 这个任务简单还是复杂？
  ├─ 简单(写一个函数) → 直接问千问 → 读完检查 → 完成
  └─ 复杂(系统设计)  → 问Gemini架构 → 读架构
       ↓
       🤔 架构清晰吗？
       ├─ 是 → 问千问实现
       └─ 否 → 追问Gemini澄清
            ↓
       🤔 千问代码质量如何？
       ├─ 好 → 问Arena审查
       └─ 有问题 → 直接问千问修复
            ↓
       🤔 Arena审查通过？
       ├─ 是 → 问清言写最终版
       └─ 有Bug → 问千问修复 → 再审查
```

## 工具文件

- `~/Desktop/hermes-tools.js` — Hermes 用来控制 Tabbit 的工具集
- `~/Desktop/orchestrator.js` (v3) — 旧的顺序流水线（保留兼容）
- `~/Desktop/parliament.js` (v4) — 旧的议会脚本（保留兼容）
