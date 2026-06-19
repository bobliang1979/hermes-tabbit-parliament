# CDP (Chrome DevTools Protocol) Tabbit Control — Technical Reference

## Connection

Tabbit Browser must start with `--remote-debugging-port=9222`.

```bash
taskkill.exe //F //IM "Tabbit Browser.exe"
"C:/Users/<user>/AppData/Local/Tabbit Browser/Application/Tabbit Browser.exe" --remote-debugging-port=9222 --restore-last-session
```

Verify:
```bash
curl -s http://localhost:9222/json/version
# → {"Browser": "Chrome/148...", "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/<uuid>"}
```

## Target Management

```javascript
// List all page targets (CDP /json endpoint — may 503 under rapid polling)
const all = await fetch("http://localhost:9222/json").then(r => r.json());
const pages = all.filter(t => t.type === "page");
```

```javascript
// Attach to a specific tab — flatten=true is MANDATORY
ws.send(JSON.stringify({
  id: 1,
  method: "Target.attachToTarget",
  params: { targetId: tabId, flatten: true }
}));
// Without flatten=true, responses don't include sessionId
```

## Reading Page Content (SPA-safe)

**DO NOT** use `document.body.innerText` — Qwen and Gemini put content elsewhere.
**ALWAYS** use `awaitPromise: false` — heavy SPAs freeze when evaluated synchronously.

```javascript
// ✅ Works on all SPAs
Runtime.evaluate({
  expression: "document.documentElement.innerText",
  returnByValue: true,
  awaitPromise: false,  // ← Critical
  timeout: 2000         // ← Short timeout, don't block
});

// ❌ Times out on Qwen/Gemini
Runtime.evaluate({
  expression: "document.body.innerText",
  returnByValue: true
  // missing awaitPromise: false → hangs for 30s+
});
```

## Typing into SPA Inputs

**DO NOT** set `el.value` or `el.innerHTML` — Angular/React ignore programmatic DOM changes.
**ALWAYS** use `Input.insertText` — it simulates real keyboard input at the OS level.

```javascript
// ✅ Works on all SPA frameworks
// Step 1: Focus
Runtime.evaluate({
  expression: `document.querySelector('[contenteditable="true"][role="textbox"]')?.focus()`,
  returnByValue: true,
  awaitPromise: false
});

// Step 2: Type
Input.insertText({ text: "Your prompt here" });

// Step 3: Submit
Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
// Then after 200ms:
Input.dispatchKeyEvent({ type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
```

## Reading Model-Specific Page Layouts

### 千问 (Qwen)
- Content: `document.documentElement.innerText`
- New Chat button: "新建对话" in sidebar (text match)
- Input: `[contenteditable="true"][role="textbox"]`
- Known: readback includes sidebar history even after new chat
- Workaround: extract response via `.slice(-2000)` to get last messages

### Grok
- Sidebar toggle: BUTTON at (8, 834), 40x40, text "切换侧边栏"
- New Chat: "新建聊天" link @ (10, 98), always visible without expand
- Content: `document.documentElement.innerText`
- Grok is a Next.js app; sidebar items are always in DOM

### Gemini
- New Chat: "New chat" link in sidebar
- Content: `document.documentElement.innerText`
- Warning: `chrome://glic/` tabs also match "Gemini" title — check URL

### 智谱清言 (ChatGLM)
- Sidebar: collapsed by default. Click "展开" (DIV.collapse-button-bg) first
- After expand: "新对话" appears as a small "+" icon (32x32 @ 822,851)
- There may be multiple "新对话" elements — click the SECOND one
- Content: `document.documentElement.innerText`

### Arena AI (Sonnet 4.6)
- New Chat: "New Chat" link in top nav
- Content: `document.documentElement.innerText`
- Input: standard textarea or contenteditable

## Common CDP Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 503 on /json | Rate limiting | Add 1s retry delay |
| Runtime.evaluate timeout | SPA main thread busy | Add `awaitPromise: false` |
| document.body.innerText empty | SPA doesn't use <body> | Use `document.documentElement.innerText` |
| Input text not appearing | Angular/React ignores DOM | Use `Input.insertText` |
| Wrong tab matched | chrome://glic/ matches "Gemini" | Verify URL after switch: `assert "gemini.google.com" in url` |
| WebSocket connection refused | Tabbit not started with --remote-debugging-port | Kill and restart with flag |
