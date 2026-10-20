> 🗄️ **Legacy (v4) — 历史参考 / historical reference**
> 这是早期固定管线脚本（parliament.js / orchestrator.js，位于 `~/Desktop`）的说明，
> **已不再是推荐做法**。当前实现与哲学见 `tools/hermes-tools.js` 与 `../../README.md`。
> These scripts hardcoded a pipeline; the project now lets Hermes decide each step.

Location: ~/Desktop/parliament.js (v4, 23796 bytes)
Usage: node parliament.js <command>
Commands:
  list         — 查看议会成员及角色
  debate <任务> — 全5模型议会辩论模式
  route <任务>  — 自适应路由 + 执行
  send <词> <提示> — 单模型发送

自适应路由分类规则:
  简单 (simple): 含 "函数/function/sort/fib/add/sum/simple" → 千问→清言
  中等 (medium): 默认 → Gemini→千问→清言
  复杂 (complex): 含 "系统/架构/分布式/设计/框架/微服务" → 全5模型

辩论协议流程:
  Round 1: Grok(搜索) + 千问(方案) + Arena(反方案) ← 并行
  Round 2: Gemini(议长) 主持总结
  Round 3: 清言(书记员) 执笔 + 验证闭环(最多3次自愈)

验证函数 validatePython():
  - 语法检查 (冒号/括号/缩进)
  - 模式检测 (pdb断点/TODO/FIXME)
  - 完整性检查 (函数/类定义)
  - 失败 → 回传修复 → 重新验证
