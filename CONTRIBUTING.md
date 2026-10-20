# Contributing / 贡献指南

Thanks for helping improve the parliament. This project intentionally has
**zero npm dependencies**, so please keep new code dependency-free.

## Ground rules / 基本规则

1. **Zero dependencies** — Node ≥ 22 ships `fetch` and a global `WebSocket`.
   Anything that needs `npm install` belongs in a separate package, not here.
2. **Hermes decides, scripts do not** — the philosophy of this repo is that an
   orchestrating agent picks the next model at runtime. Don't add code that
   hardcodes a full pipeline as the *default* path.
3. **stdout is data, stderr is logs** — the CLI prints answers (or JSON) to
   stdout and all progress to stderr so it can be piped.
4. **Every change needs a test** — see below.

## Layout / 目录

| Path | What it is |
|------|-----------|
| `tools/hermes-tools.js` | The CLI. Pure logic is exported for tests. |
| `tools/fable5_agent.py`, `tools/fable5_server.py` | Example output produced by the parliament (Python). |
| `skill/SKILL.md` | The agent-skill definition that teaches an LLM to drive the CLI. |
| `skill/references/` | Case study, CDP notes, legacy designs. |
| `test/` | `node --test` unit tests + a mock CDP server for end-to-end tests. |

## Running the tests / 运行测试

```bash
npm test                 # unit + end-to-end (spawns the real CLI against a mock CDP server)
node --test test/hermes-tools.test.js   # pure logic only
node --test test/cli.test.js            # CLI end-to-end only
```

The end-to-end tests need no browser: `test/mock-cdp.js` is a tiny
dependency-free WebSocket + HTTP server that speaks just enough CDP
(`/json`, `Target.attachToTarget`, `Runtime.evaluate`, `Input.*`).

## Adding a model / 新增模型

Add an entry to `MODELS` in `tools/hermes-tools.js`:

```js
{
  id: "perplexity",
  emoji: "🔎",
  role: "Librarian / 资料员",
  duty: "…",
  aliases: ["perplexity", "资料员"],
  match: { url: [/perplexity\.ai/i], title: [/perplexity/i] },
  exclude: [/^chrome:\/\//i],
  newChat: { labels: ["New chat"], nth: 1 },
  input: ['textarea', '[contenteditable="true"]'],
}
```

Then add a fixture tab to `DEFAULT_TABS` in `test/mock-cdp.js` and a
resolution case in `test/hermes-tools.test.js`. The registry test asserts
every entry has all required fields, so it will tell you if you forgot one.

> `exclude` matters: `chrome://glic/` pages are titled "Gemini" and will
> otherwise hijack the Speaker seat.

## Commit style / 提交规范

Conventional commits, English or Chinese subjects are both fine:

```
feat(tools): add --tail flag to read
fix(cdp): retry /json on HTTP 503
docs(readme): document doctor command
test(cli): cover stdin prompts
```

## Pull requests / PR

- Branch from `main`, keep PRs focused on one change.
- `npm test` must pass locally.
- If you change CLI behaviour, update `README.md`, `skill/SKILL.md` and the
  `--help` text in the same PR.
