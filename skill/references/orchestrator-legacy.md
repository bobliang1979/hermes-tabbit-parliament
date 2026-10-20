> 🗄️ **Legacy (v4) — 历史参考 / historical reference**
> 这是早期固定管线脚本（parliament.js / orchestrator.js，位于 `~/Desktop`）的说明，
> **已不再是推荐做法**。当前实现与哲学见 `tools/hermes-tools.js` 与 `../../README.md`。
> These scripts hardcoded a pipeline; the project now lets Hermes decide each step.

Tool: ~/Desktop/orchestrator.js (22239 bytes, Node.js v24+)
- No npm dependencies (native WebSocket)
- Commands: list, send <kw> <prompt>, workflow <task>
- CDP endpoint: http://localhost:9222
- Uses Input.insertText (SPA-safe), document.documentElement.innerText (not body)
- Context reset before each send: newChat() → phase 1-4 text/aria/icon matching
- 5 model collaboration: Gemini→Grok→Qwen→Arena Sonnet 4.6→ChatGLM
