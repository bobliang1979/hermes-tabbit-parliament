<div align="center">



# 🧠 Hermes Tabbit Parliament



**多模型 AI 议会协作框架 · Multi-Model AI Parliament Framework**



[![GitHub](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)

[![Platform](https://img.shields.io/badge/platform-Tabbit%20Browser-important)](https://tabbit.com)

[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)



*不是固定管线。Hermes 每一步思考后决定。*  

*Not a fixed pipeline. Hermes thinks at every step and decides.*



</div>



---



## 📋 目录 | Table of Contents



- [🇨🇳 中文](#-中文)

- [🇬🇧 English](#-english)

- [🏛️ Architecture](#-architecture)

- [🚀 Quick Start](#-quick-start)

- [🛠️ Tools](#-tools)

- [📦 Project Structure](#-project-structure)

- [📄 License](#-license)



---



## 🇨🇳 中文



### 核心思想



**Hermes Tabbit Parliament** 是一个多模型 AI 议会协作框架。Hermes 作为中央大脑，通过 Chrome DevTools Protocol (CDP) 控制 Tabbit 浏览器中的 5 个 AI 模型标签页，实现有意识的交互式推理协作。



传统多模型协作采用固定流水线（A→B→C→D），每个模型按预设顺序执行，无法根据中间结果动态调整。



Hermes Tabbit Parliament 颠覆了这一模式：**Hermes 先分析任务，决定问哪个模型，读完回复后再思考，再决定下一步**——如同一个真正的议会，议长根据各方意见动态决策。



### 5 模型议会制



| 角色 | 模型 | 职责 |

|------|------|------|

| 🧠 **议长 (Speaker)** | **Hermes** | 任务分析、动态路由、综合输出 |

| 🔍 **研究员 (Researcher)** | **Grok** | 搜索事实、查找库、纠正错误假设 |

| 💬 **工程师 (Engineer)** | **千问 (Qwen)** | 方案设计、代码编写、技术实现 |

| 🤝 **评审官 (Reviewer)** | **Arena Sonnet 4.6** | 审计方案、发现漏洞、安全审查 |

| ✍️ **书记员 (Scribe)** | **智谱清言 (ChatGLM)** | 执笔最终代码、文档生成 |



### 工作流模式



#### 🏛️ 议会全流程 — 复杂任务



```

Step 1: 🔍 Grok 搜索技术细节 → Hermes 分析

Step 2: 💬 千问 设计方案 → Hermes 分析

Step 3: 🤝 Arena 审查方案 → Hermes 分析

Step 4: 🧠 Gemini 综合决策 → Hermes 分析

Step 5: ✍️ 清言 执笔代码 → Hermes 验证输出

```



#### 🔄 快速验证 — 中等任务



```

Step 1: 💬 千问 设计方案

Step 2: 🤝 Arena 审查方案

Step 3: Hermes 综合输出

```



#### ⚡ 直接编码 — 简单任务



```

Step 1: 💬 千问 写代码

Step 2: Hermes 验证输出

```



### 技术栈



| 组件 | 技术 | 说明 |

|------|------|------|

| 浏览器 | Tabbit Browser | Chromium 内核，运行 5 个 AI 模型标签页 |

| 控制协议 | CDP (Chrome DevTools Protocol) | WebSocket 双向通信控制浏览器 |

| 运行时 | Node.js v24+ | 原生 WebSocket，零 npm 依赖 |

| SPA 兼容 | `Input.insertText` | 绕过 React/Angular 变更检测，直接输入 |

| 内容读取 | `document.documentElement.innerText` | 兼容 SPA 不渲染 `<body>` 的问题 |

| 超时处理 | `awaitPromise: false` | 防止 SPA 页面因未解决的 Promise 超时 |



### 关键特性



- ✅ **动态决策** — Hermes 根据回复现场决定下一步，非固定管线

- ✅ **上下文隔离** — 每次发送自动新建对话，防止历史污染

- ✅ **多端兼容** — 统一适配 5 个模型的 UI 差异

- ✅ **自愈闭环** — 验证代码语法，发现问题自动回传修复

- ✅ **零依赖** — 仅需 Node.js v24+



### 真实案例



在 [Fable-5 Agent 设计](skill/references/fable5-case-study.md) 中，议会模式展现了卓越效果：



- 🔍 **Grok** 纠正了一个关键的 XML 格式假设——如果按错误假设开发，整个解析器都需要重写

- 💬 **千问** 提出了生产级的 4 层架构设计方案

- 🤝 **Arena** 发现了 **P0 级安全漏洞**（缺少沙箱隔离）和 **OOM 风险**（40GB+ 内存溢出）

- 🧠 **Gemini** 综合所有观点做出了最终架构决策

- ✍️ **清言** 编写了完整的 376 行实现



这个案例证明：**交互式议会模式比固定管线更灵活、更可靠**。每个模型都能发现其他模型遗漏的问题。



---



## 🇬🇧 English



### Core Philosophy



**Hermes Tabbit Parliament** is a multi-model AI parliament collaboration framework. Hermes acts as the central brain, controlling 5 AI model tabs in the Tabbit browser via Chrome DevTools Protocol (CDP), enabling conscious interactive reasoning collaboration.



Traditional multi-model collaboration uses a fixed pipeline (A→B→C→D), where each model executes in a predetermined order without the ability to adapt based on intermediate results.



Hermes Tabbit Parliament disrupts this paradigm: **Hermes analyzes the task, decides which model to query, reads the response, thinks about it, then decides the next move** — just like a real parliament where the speaker dynamically steers the discussion based on input from all members.



### The 5-Model Parliament



| Role | Model | Responsibility |

|------|-------|---------------|

| 🧠 **Speaker** | **Hermes** | Task analysis, dynamic routing, synthesis |

| 🔍 **Researcher** | **Grok** | Fact-finding, library search, assumption correction |

| 💬 **Engineer** | **Qwen** | Solution design, code writing, implementation |

| 🤝 **Reviewer** | **Arena Sonnet 4.6** | Code audit, vulnerability discovery, security review |

| ✍️ **Scribe** | **ChatGLM** | Final code writing, documentation |



### Workflow Patterns



**Full Parliament (Complex Tasks)**



```

Step 1: 🔍 Grok researches → Hermes analyzes

Step 2: 💬 Qwen designs → Hermes analyzes

Step 3: 🤝 Arena reviews → Hermes analyzes

Step 4: 🧠 Gemini decides → Hermes analyzes

Step 5: ✍️ ChatGLM writes → Hermes verifies

```



**Quick Review (Medium Tasks)**



```

Step 1: 💬 Qwen designs solution

Step 2: 🤝 Arena reviews solution

Step 3: Hermes synthesizes → deliver

```



**Direct Coding (Simple Tasks)**



```

Step 1: 💬 Qwen writes code

Step 2: Hermes verifies → deliver

```



### Key Features



- ✅ **Dynamic decision-making** — Hermes decides each step based on responses, not a fixed pipeline

- ✅ **Context isolation** — Auto-creates new conversations to prevent history contamination

- ✅ **Cross-platform** — Unified adaptation across 5 different AI model UIs

- ✅ **Self-healing loop** — Code syntax verification with auto-fix iteration

- ✅ **Zero dependencies** — Requires only Node.js v24+



### Production Case Study



In the [Fable-5 Agent design](skill/references/fable5-case-study.md):



- 🔍 **Grok** corrected a critical XML format assumption — the entire parser would have been built on wrong foundations

- 💬 **Qwen** proposed a production-grade 4-layer architecture

- 🤝 **Arena** discovered **P0 security vulnerabilities** (missing sandbox isolation) and **OOM risks** (40GB+ memory usage)

- 🧠 **Gemini** synthesized all views into a final architecture decision

- ✍️ **ChatGLM** wrote the complete 376-line implementation



**This real-world example proves that the interactive parliament model outperforms fixed pipelines: each model catches what others miss.**



---



## 🏛️ Architecture



### CDP Communication



```

┌─────────────────────────────────────────────────┐

│                   Hermes                        │

│         Task Analysis → Decision → Synthesis     │

└────────────────┬──────────┬──────────┬──────────┘

                 │          │          │

    ┌────────────▼──┐ ┌─────▼─────┐ ┌──▼──────────┐

    │   CDP Client  │ │ File I/O  │ │  Code Exec  │

    │  (WebSocket)  │ │ (read/    │ │  (Python/   │

    │               │ │  write)   │ │   Node.js)  │

    └────────────┬──┘ └───────────┘ └─────────────┘

                 │

    ┌────────────▼────────────────────────────────┐

    │           Tabbit Browser (CDP :9222)          │

    ├────────┬────────┬────────┬────────┬─────────┤

    │ Gemini │  Grok  │  Qwen  │ Arena  │ ChatGLM │

    │ (议长)  │ (研究员)│ (工程师)│ (评审官)│ (书记员) │

    └────────┴────────┴────────┴────────┴─────────┘

```



### Context Isolation



Each message is sent in a **fresh conversation** to prevent context contamination:



| Model | Button | Strategy |

|-------|--------|----------|

| Gemini | `New chat` | Text match → click |

| Grok | `新建聊天` | Text match → click |

| Qwen | `新建对话` | Text match → click |

| ChatGLM | `展开` → second `新对话` | Expand sidebar → find second button |

| Arena | `New Chat` | Text match → click |



---



## 🚀 Quick Start



### Prerequisites



- [Tabbit Browser](https://tabbit.com) installed

- Node.js v24+ (native WebSocket)

- 5 AI model tabs open: Gemini, Grok, Qwen, Arena.ai (Sonnet 4.6), ChatGLM



### 1. Start Tabbit with Debug Mode



```bash

# Windows

taskkill.exe //F //IM "Tabbit Browser.exe"

"C:/Users/<user>/AppData/Local/Tabbit Browser/Application/Tabbit Browser.exe" \

  --remote-debugging-port=9222 --restore-last-session

```



### 2. Install Tools



```bash

# hermes-tools.js requires no npm install — pure Node.js native WebSocket

cd tools/

```



### 3. List Models



```bash latest Python asyncio best practices"

node tools/hermes-tools.js ask gemini "Analyze this architecture for weaknesses"

node tools/hermes-tools.js ask arena "Review this code for security issues"

node tools/hermes-tools.js ask 清言 "Write the final implementation"

```



---



## 🛠️ Tools



| File | Description |

|------|-------------|

| `tools/hermes-tools.js` | Core interaction tool — list, ask, read, new conversation |

| `tools/fable5_agent.py` | Fable-5 Agent engine example (376 lines) |

| `tools/fable5_server.py` | FastAPI server example for the agent |

| `skill/SKILL.md` | Hermes Agent skill definition (v6.0.0) |

| `skill/references/` | Case studies and technical documentation |



---



## 📦 Project Structure



```

├── tools/

│   ├── hermes-tools.js        # Core: model interaction (recommended)

│   ├── fable5_agent.py        # Fable-5 Agent engine (example)

│   └── fable5_server.py       # FastAPI server (example)

├── skill/

│   ├── SKILL.md               # Hermes Agent skill definition

│   └── references/

│       ├── fable5-case-study.md   # Real-world Fable-5 case study

│       ├── cdp-technical-details.md  # CDP protocol details

│       └── ...

├── .gitignore

└── README.md

```



---



## 📄 License



MIT © [bobliang1979](https://github.com/bobliang1979)



---



<div align="center">

  <sub>Built with ❤️ by Hermes Agent + 5 AI models in Tabbit Browser</sub>

</div>



node tools/hermes-tools.js list

```



### 4. Ask a Model



```bash

node tools/hermes-tools.js ask 千问 "Write a Python LRU Cache with TTL"

node tools/hermes-tools.js ask grok "Searchp align="center">
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
