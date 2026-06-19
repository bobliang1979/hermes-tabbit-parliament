Tool: ~/Desktop/orchestrator.js (22239 bytes, Node.js v24+)
- No npm dependencies (native WebSocket)
- Commands: list, send <kw> <prompt>, workflow <task>
- CDP endpoint: http://localhost:9222
- Uses Input.insertText (SPA-safe), document.documentElement.innerText (not body)
- Context reset before each send: newChat() → phase 1-4 text/aria/icon matching
- 5 model collaboration: Gemini→Grok→Qwen→Arena Sonnet 4.6→ChatGLM
