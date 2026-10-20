<div align="center">

# 🧠 Hermes Tabbit Parliament

**多模型 AI 议会协作框架 · Multi-Model AI Parliament Framework**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#零依赖--zero-dependencies)
[![CI](https://github.com/bobliang1979/hermes-tabbit-parliament/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*不是固定管线。Hermes 每一步思考后决定。*
*Not a fixed pipeline. Hermes thinks at every step and decides.*

</div>

---

## 目录 · Table of Contents

- [核心思想 · Core Idea](#核心思想--core-idea)
- [5 模型议会 · The Parliament](#5-模型议会--the-parliament)
- [快速开始 · Quick Start](#快速开始--quick-start)
- [命令与选项 · CLI](#命令与选项--cli)
- [工作流模式 · Workflow Patterns](#工作流模式--workflow-patterns)
- [架构 · Architecture](#架构--architecture)
- [可靠性设计 · Reliability](#可靠性设计--reliability)
- [测试 · Testing](#测试--testing)
- [故障排除 · Troubleshooting](#故障排除--troubleshooting)
- [项目结构 · Project Structure](#项目结构--project-structure)
- [License](#license)

---

## 核心思想 · Core Idea

Hermes Tabbit Parliament turns the AI chat tabs already open in your
[Tabbit](https://tabbit.com) browser into a **council of specialists**.
Hermes (the orchestrating agent) drives them over the Chrome DevTools
Protocol (CDP).

Traditional multi-model setups are fixed pipelines: `A → B → C → D`, decided
before anyone has said anything. This one isn't:

```
❌ 固定管线: 脚本按预设顺序跑完 5 个模型
✅ 议会模式: Hermes 分析任务 → 选一个模型提问 → 读回复 → 思考 → 再决定下一步
```

Hermes reads every reply before choosing the next move, so a fact found by the
researcher can change the question asked of the engineer, and a vulnerability
found by the reviewer can send the design back for a rewrite.

---

## 5 模型议会 · The Parliament

| 模型 / Model | 角色 / Role | 职责 / Responsibility | 别名 / Aliases |
|---|---|---|---|
| 🧠 **Gemini** | 议长 / Speaker | 综合多方观点、做最终决策 · synthesize views, final call | `gemini`, `议长`, `speaker` |
| 🔍 **Grok** | 研究员 / Researcher | 搜索事实、找库、纠正错误假设 · facts, libraries, corrections | `grok`, `研究员`, `researcher` |
| 💬 **千问 Qwen** | 工程师 / Engineer | 方案设计、代码实现 · design solutions, write code | `qwen`, `qianwen`, `千问`, `通义`, `工程师` |
| 🤝 **Arena Sonnet** | 评审官 / Reviewer | 挑漏洞、安全审查 · find holes, security review | `arena`, `arena.ai`, `评审官`, `reviewer` |
| ✍️ **智谱清言 ChatGLM** | 书记员 / Scribe | 执笔最终代码与文档 · write final code and docs | `chatglm`, `glm`, `清言`, `智谱`, `书记员` |

Every alias works anywhere a model name is expected, so both
`ask 千问 "…"` and `ask qwen "…"` hit the same tab.

**Real-world proof:** in the [Fable-5 Agent case study](skill/references/fable5-case-study.md),
Grok caught a wrong XML-tag assumption before any code was written, Arena
found a P0 sandbox-isolation hole and a 40 GB OOM risk, Gemini arbitrated,
and ChatGLM produced the final implementation. Each model caught something
the others missed.

---

## 快速开始 · Quick Start

### 零依赖 · Zero dependencies

No `npm install`. Node ≥ 22 provides the global `WebSocket` and `fetch` used
by the CLI.

```bash
node --version   # >= 22
```

### 1. 用调试模式启动 Tabbit · Start Tabbit with CDP

```powershell
# Windows
taskkill.exe //F //IM "Tabbit Browser.exe"
"C:/Users/<you>/AppData/Local/Tabbit Browser/Application/Tabbit Browser.exe" `
  --remote-debugging-port=9222 --restore-last-session
```

Keep one tab open and logged in for each model.

### 2. 体检 · Diagnose

```bash
node tools/hermes-tools.js doctor
```

```
🩺 Hermes Parliament — 诊断
  CDP 端点: http://127.0.0.1:9222
  TCP 连通: ✅
  浏览器: Chrome/148...
  ✅ 🧠 gemini    Gemini
  ✅ 🔍 grok      Grok
  ✅ 💬 qwen      千问
  ✅ 🤝 arena     Arena.ai
  ✅ ✍️ chatglm   智谱清言
```

### 3. 提问 · Ask

```bash
node tools/hermes-tools.js list
node tools/hermes-tools.js ask 千问 "写一个带 TTL 的 Python LRU Cache"
node tools/hermes-tools.js read grok
node tools/hermes-tools.js new gemini
```

The answer is printed to **stdout**; progress logs go to **stderr**; a
markdown copy is saved to `out/` (git-ignored).

### 跑一遍完整议会 · Run the whole council

```bash
./examples/parliament.sh "设计一个支持 10 万并发的实时推送系统"
```

That chains 研究员 → 工程师 → 评审官 → 议长 → 书记员, forwarding a trimmed
copy of each answer to the next model, and writes every stage to
`out/parliament-<timestamp>/`. Treat it as a playbook to copy from, not as
the only way to run a parliament — Hermes can always stop early or reorder.

---

## 命令与选项 · CLI

```
node tools/hermes-tools.js <command> [options]
```

| 命令 / Command | 作用 / What it does |
|---|---|
| `models` | 显示模型注册表（角色 + 匹配规则 + 别名） |
| `list` (`ls`) | 列出浏览器标签页及其议会角色；`--json` 输出结构化数据 |
| `ask <模型> <提示>` | 新建对话 → 发送 → 等待回复稳定 → 读取回复 |
| `read <模型>` | 读取当前页面文本 |
| `new <模型>` | 新建对话（上下文隔离） |
| `doctor` | 诊断 CDP 连接、标签页匹配、未识别站点 |

### 常用选项 · Options

| 选项 | 默认 | 说明 |
|---|---|---|
| `--port <n>` | `9222` (env `TABBIT_CDP_PORT`) | CDP 端口 |
| `--host <addr>` | `127.0.0.1` (env `TABBIT_CDP_HOST`) | CDP 主机 |
| `--timeout <sec>` | `180` | 等待回复的上限 |
| `--poll <sec>` | `2` | 轮询间隔 |
| `--stable <n>` | `3` | 连续 n 次文本不变才认为回复结束 |
| `--no-new` | off | 不新建对话，直接追加到当前会话 |
| `--no-focus` | off | 不调用 `Page.bringToFront` |
| `--no-stream-detect` | off | 关闭「生成中」指示灯检测 |
| `--tail <n>` | off | 只保留回复末尾 n 个字符 |
| `--out <dir>` | `out/` | 回复保存目录 |
| `--no-save` | off | 不写文件 |
| `--json` | off | stdout 输出 JSON 信封（含 status / chars / elapsed / file） |
| `-` | — | 提示词从 stdin 读取 |

### 退出码 · Exit codes

| Code | 含义 |
|---|---|
| `0` | 成功 |
| `2` | 用法错误（缺参数、未知命令） |
| `3` | 未找到模型/标签页 |
| `4` | CDP 不可达（Tabbit 没开调试端口） |
| `5` | 超时或无回复 |

Because of the exit codes, the CLI composes cleanly in agent loops:

```bash
node tools/hermes-tools.js ask arena "审查这段架构" --json | jq -r .answer
echo "写最终实现" | node tools/hermes-tools.js ask 清言 --timeout 300 -
```

---

## 工作流模式 · Workflow Patterns

Hermes picks a pattern per task — these are playbooks, not hardcoded flows.

### A. 议会全流程 · Full Parliament（复杂任务）

```
🔍 ask grok   "搜索 X 的技术细节"          → Hermes 读 → 发现关键事实
💬 ask 千问   "基于这些事实设计架构"        → Hermes 读 → 获得方案
🤝 ask arena  "审查这个方案的漏洞"          → Hermes 读 → 发现 P0 问题
🧠 ask gemini "综合三方意见做最终决策"      → Hermes 读 → 获得决策
✍️ ask 清言   "根据决策写最终实现"          → Hermes 读 → 获得代码
🧠 Hermes 自己验证 → 交付
```

### B. 快速验证 · Quick Review（中等任务）

```
💬 ask 千问 "设计方案" → 🤝 ask arena "审查方案" → 🧠 Hermes 综合输出
```

### C. 直接编码 · Direct Coding（简单任务）

```
💬 ask 千问 "写这个函数" → 🧠 Hermes 验证 → 交付
```

### D. 搜索 + 实现 · Research then Implement

```
🔍 ask grok "搜索最新 API" → 💬 ask 千问 "据此实现" → 🧠 Hermes 验证 → 交付
```

### 上下文隔离 · Context isolation

By default every `ask` clicks that model's "new chat" control first, so no
model is polluted by an earlier question. Use `--no-new` when you *want* the
model to see its own previous turn.

---

## 架构 · Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Hermes                            │
│         task → pick a model → read → think → repeat       │
└───────────────┬──────────────────────────────────────────┘
                │  node tools/hermes-tools.js ask <model> <prompt>
    ┌───────────▼────────────┐        ┌──────────────────┐
    │  CDP client (WebSocket)│        │ out/*.md 落盘     │
    └───────────┬────────────┘        └──────────────────┘
                │  http://127.0.0.1:9222/json   +   ws://…/devtools/browser/<id>
    ┌───────────▼──────────────────────────────────────────┐
    │              Tabbit Browser (Chromium)                │
    ├────────┬────────┬────────┬─────────┬────────────────┤
    │ Gemini │  Grok  │  Qwen  │  Arena  │    ChatGLM     │
    │ 议长    │ 研究员  │ 工程师 │ 评审官  │    书记员       │
    └────────┴────────┴────────┴─────────┴────────────────┘
```

### 协议要点 · Protocol notes

| 环节 | 做法 | 原因 |
|---|---|---|
| 附加标签 | `Target.attachToTarget` with `flatten: true` | 没有 `flatten` 就没有 `sessionId` |
| 输入 | `Input.insertText` 分块（3000 字符/块） | React/Angular 忽略程序化 DOM 赋值 |
| 提交 | `Input.dispatchKeyEvent` rawKeyDown + keyUp | 模拟真实回车 |
| 读取 | `document.documentElement.innerText` | 部分 SPA 不渲染 `<body>` |
| 读取 | `awaitPromise: false` | 重型 SPA 主线程忙时会挂死 |
| 完成判定 | 文本连续 N 次轮询不变 + 无「停止生成」按钮 | 固定 sleep 不是早截断就是白等 |

See [skill/references/cdp-technical-details.md](skill/references/cdp-technical-details.md)
for the per-model UI quirks, and [skill/SKILL.md](skill/SKILL.md) for the
skill definition an agent can load to drive all of this.

---

## 可靠性设计 · Reliability

The original one-file tool slept 25 s and hoped for the best. v2 makes each
failure mode explicit:

| 风险 / Risk | v1 | v2 |
|---|---|---|
| 回复被截断 / truncated reply | 固定 sleep 25 s | 轮询至文本稳定（`--stable`）+ 「生成中」指示灯检测 |
| 提问打到错的标签 / wrong tab | 标题子串匹配（`chrome://glic/` 也叫 Gemini） | URL + 标题规则 + `exclude` 黑名单 |
| `/json` 被限流 | 直接崩 | 503 自动退避重试 |
| 模型没开 | 静默无输出 | `doctor` 逐模型体检 + 退出码 4/3 |
| 输出污染仓库 | 仓库根目录散落 `hermes_ask_*.md` | 统一写入 `out/`（gitignore） |
| 无法被脚本消费 | 日志与答案混在 stdout | 答案→stdout，日志→stderr，`--json` 信封 |
| 卡死 | 未清理的定时器 | 所有请求带超时，会话结束时清理 |

---

## 测试 · Testing

```bash
npm test
```

26 tests, no browser and no network required:

- `test/hermes-tools.test.js` — pure logic: model resolution, alias matching,
  `chrome://glic/` exclusion, completion detection, answer extraction, chunking,
  argument parsing.
- `test/mock-cdp.js` — a dependency-free mock CDP endpoint (HTTP + WebSocket,
  hand-rolled frames) that simulates a streaming reply.
- `test/cli.test.js` — spawns the real CLI against that mock and asserts on
  exit codes, stdout JSON, saved files, and the CDP calls actually made.

CI (`.github/workflows/ci.yml`) runs the suite on Node 22 and 24, smoke-tests
the CLI, and byte-compiles the Python examples.

---

## 故障排除 · Troubleshooting

| 现象 | 原因 | 处理 |
|---|---|---|
| `无法连接 Tabbit CDP` (exit 4) | Tabbit 没带调试端口启动 | 加 `--remote-debugging-port=9222` 重启 |
| `未找到模型 "x"` (exit 3) | 标签页没开或标题变了 | `list` 看在线标签，必要时在 `MODELS` 加规则 |
| 匹配到 `chrome://glic/` | 内部页面也叫 Gemini | 已被 `exclude` 拦截；仍异常请升级到 v2 |
| 回复很短 (status `timeout`) | 模型还在生成 | 加大 `--timeout`，或 `--stable 2` 提前收尾 |
| 找到输入框失败 | 页面需要登录 / 结构变了 | 手动打开一次该站点登录；检查 `MODELS[id].input` |
| 答案里混着侧边栏 | SPA 重排导致基线失效 | 用 `--tail N` 或让 Hermes 只取末尾 |
| Node 报 `WebSocket is not defined` | Node < 22 | 升级 Node（≥ 22 有全局 WebSocket） |

---

## 项目结构 · Project Structure

```
hermes-tabbit-parliament/
├── examples/
│   └── parliament.sh          # 模式 A「议会全流程」的可运行示例脚本
├── tools/
│   ├── hermes-tools.js        # CLI — 控制 5 个模型（零依赖）
│   ├── fable5_agent.py        # 议会产出的示例：Fable-5 Agent 引擎
│   └── fable5_server.py       # 议会产出的示例：FastAPI 服务器
├── skill/
│   ├── SKILL.md               # Agent 技能定义（教 LLM 如何驱动议会）
│   └── references/
│       ├── fable5-case-study.md      # 真实交互记录
│       ├── cdp-technical-details.md  # CDP 与各模型 UI 细节
│       ├── hermes-workflow.md        # Hermes 的交互式决策流
│       ├── parliament-legacy.md      # v4 固定管线（历史参考）
│       └── orchestrator-legacy.md    # v3 编排器（历史参考）
├── test/
│   ├── hermes-tools.test.js   # 纯逻辑单测
│   ├── cli.test.js            # CLI 端到端测试
│   └── mock-cdp.js            # 零依赖 CDP mock 服务器
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## License

MIT © [bobliang1979](https://github.com/bobliang1979)

---

<div align="center">
  <sub>Built with ❤️ by Hermes Agent + 5 AI models in Tabbit Browser</sub>
</div>
