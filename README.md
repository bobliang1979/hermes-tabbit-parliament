<p align="center">
  <img src="https://img.shields.io/badge/status-active-success" alt="Status">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/platform-Tabbit%20Browser-important" alt="Platform">
</p>

<br>

<p align="center">
  <h1 align="center">🧠 Hermes Tabbit Parliament</h1>
  <p align="center"><strong>Multi-Model AI Parliament — Orchestrate 5 AI models in your browser as a collaborative council</strong></p>
</p>

<p align="center">
  <i>Not a fixed pipeline. Hermes thinks at every step, decides which model to ask next, reads the response, and adapts.</i>
</p>

---

## 🌟 Overview

**Hermes Tabbit Parliament** transforms your browser tabs into an **AI council** — 5 different AI models working together as specialized agents, coordinated by Hermes (an orchestrator LLM) through Chrome DevTools Protocol (CDP).

Instead of hardcoding a pipeline, **Hermes dynamically decides** which model to consult based on the task, reads each response, and adapts the next move — just like a real parliament.

### The 5 Models

| Model | Role | Responsibility | How Hermes Uses It |
|-------|------|---------------|-------------------|
| 🔍 **Grok** | Researcher | Search facts, find libraries, correct assumptions | "Need to search for latest info" |
| 💬 **Qwen (千问)** | Engineer | Design architecture, write code | "Need a technical solution" |
| 🤝 **Arena (Sonnet 4.6)** | Reviewer | Find bugs, security holes, critique | "Got a solution, need it reviewed" |
| 🧠 **Gemini** | Speaker | Synthesize views, make final decisions | "Multiple opinions, need a decision" |
| ✍️ **ChatGLM (清言)** | Scribe | Write final production code | "All decisions made, write the code" |

### Real-World Impact

In a production use case ([Fable-5 Agent design](./skill/references/fable5-case-study.md)):
- 🔍 **Grok** corrected a critical XML format assumption that would have broken the entire parser
- 💬 **Qwen** proposed the 4-layer architecture
- 🤝 **Arena** discovered **P0 security issues** (missing sandbox isolation) and **OOM risks** (40GB+ memory)
- 🧠 **Gemini** synthesized all views into a final architecture decision
- ✍️ **ChatGLM** wrote the complete implementation (376 lines)

---

## 🚀 Quick Start

### Prerequisites

- [Tabbit Browser](https://tabbit.com) installed
- Node.js v24+ (native WebSocket, no npm modules needed)
- 5 AI model tabs open in Tabbit: Gemini, Grok, Qwen, Arena.ai (Sonnet 4.6), ChatGLM

### 1. Start Tabbit with CDP Debug Mode

```bash
# Windows
taskkill.exe //F //IM "Tabbit Browser.exe"

"C:/Users/<user>/AppData/Local/Tabbit Browser/Application/Tabbit Browser.exe" \
  --remote-debugging-port=9222 \
  --restore-last-session
```

### 2. Verify CDP Connection

```bash
curl -s http://localhost:9222/json | python3 -c "
import json, sys
tabs = json.load(sys.stdin)
for t in tabs:
    if t.get('type') == 'page':
        print(t['title'][:30], '|', t['url'][:60])
"
```

### 3. Ask a Model

```bash
# List available models
node tools/hermes-tools.js list

# Ask a question (auto-creates new conversation)
node tools/hermes-tools.js ask 千问 "Write a Python LRU Cache with TTL"

# Read current page content
node tools/hermes-tools.js read grok

# Force new conversation
node tools/hermes-tools.js new gemini
```

---

## 🏛️ Workflow Patterns

### Pattern A: Full Parliament (Complex Tasks)

```
Hermes: "This task is complex, run the full parliament"

Step 1: 🔍 ask Grok "Search technical details..."
  → Hermes reads → discovers critical info
Step 2: 💬 ask Qwen "Design architecture based on Grok's findings..."
  → Hermes reads → gets architecture plan
Step 3: 🤝 ask Arena "Review Qwen's architecture for vulnerabilities..."
  → Hermes reads → finds security holes
Step 4: 🧠 ask Gemini "Synthesize all opinions, make final decision..."
  → Hermes reads → gets final architecture
Step 5: ✍️ ask ChatGLM "Write final code based on all discussions..."
  → Hermes reads → gets implementation
Step 6: Hermes verifies and delivers
```

### Pattern B: Quick Review (Medium Tasks)

```
Step 1: 💬 ask Qwen "Design solution..."
Step 2: 🤝 ask Arena "Review solution..."
Step 3: Hermes synthesizes → deliver
```

### Pattern C: Direct Coding (Simple Tasks)

```
Step 1: 💬 ask Qwen "Write code..."
Step 2: Hermes verifies → deliver
```

### Pattern D: Research + Implement

```
Step 1: 🔍 ask Grok "Search..."
Step 2: 💬 ask Qwen "Implement based on search..."
Step 3: Hermes verifies → deliver
```

---

## ⚙️ How It Works

### CDP Protocol

All model interactions happen through Chrome DevTools Protocol WebSocket:

```javascript
// 1. Connect to an AI model tab
WebSocket → Target.attachToTarget({ targetId, flatten: true })
// flatten=true is CRITICAL — responses include sessionId

// 2. Type into chat input (SPA-safe)
Input.insertText({ text: "Your prompt here" })
// NOT DOM manipulation — SPA frameworks ignore programmatic input

// 3. Submit
Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Enter", ... })

// 4. Read response (SPA-compatible)
Runtime.evaluate({
  expression: "document.documentElement.innerText",
  returnByValue: true,
  awaitPromise: false  // Prevents timeout on heavy SPAs
})
```

### Context Isolation (New Chat)

Before each prompt, the tool automatically clicks the "New Chat" button to prevent context contamination:

| Model | Button | Strategy |
|-------|--------|----------|
| Gemini | `New chat` | Text match → click |
| Grok | `新建聊天` | Text match → click |
| Qwen | `新建对话` | Text match → click |
| ChatGLM | `展开` → 2nd `新对话` | Expand sidebar → find second button |
| Arena | `New Chat` | Text match → click |

---

## 📦 Project Structure

```
├── tools/
│   ├── hermes-tools.js        # Core: model interaction tool (recommended)
│   ├── fable5_agent.py        # Fable-5 Agent engine (example output)
│   └── fable5_server.py       # FastAPI server (example output)
├── skill/
│   ├── SKILL.md               # Hermes Agent skill definition
│   └── references/            # Case studies and docs
└── README.md
```

---

## 🧪 Real-World Case Study

See the full [Fable-5 Agent Design](./skill/references/fable5-case-study.md) for a complete walkthrough of:
- How Grok corrected a wrong XML format assumption
- How Arena discovered P0 security vulnerabilities
- How Gemini synthesized all views into a final architecture
- The complete 376-line agent engine that resulted

---

## 🛠️ Technical Requirements

| Requirement | Version | Why |
|------------|---------|-----|
| Tabbit Browser | Latest | Chromium-based browser with AI chat tabs |
| Node.js | v24+ | Native `WebSocket` global (no npm install) |
| Python | 3.11+ | For example agent scripts |
| OS | Windows | (Tabbit is Windows-native) |

---

## 📄 License

MIT © [bobliang1979](https://github.com/bobliang1979)

---

<p align="center">
  <sub>Built with ❤️ by Hermes Agent + 5 AI models in Tabbit Browser</sub>
</p>
