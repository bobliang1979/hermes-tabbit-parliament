/**
 * End-to-end CLI tests: spawn `tools/hermes-tools.js` against the in-process
 * mock CDP server (test/mock-cdp.js). No browser needed.
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { MockCdp } = require("./mock-cdp.js");

const CLI = path.join(__dirname, "..", "tools", "hermes-tools.js");

function runCli(args, { stdin, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, TABBIT_CDP_HOST: "127.0.0.1" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    if (stdin !== undefined) {
      child.stdin.end(stdin);
    } else {
      child.stdin.end();
    }
  });
}

test("list --json reports every tab with its parliament role", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const res = await runCli(["--port", String(server.port), "list", "--json"]);
  assert.equal(res.code, 0, res.stderr);
  const payload = JSON.parse(res.stdout);
  assert.equal(payload.count, 6);
  assert.deepEqual(payload.missing, [], "the whole parliament is online in the fixture");
  const byModel = Object.fromEntries(payload.tabs.filter((x) => x.model).map((x) => [x.model, x]));
  assert.deepEqual(Object.keys(byModel).sort(), ["arena", "chatglm", "gemini", "grok", "qwen"]);
  assert.ok(byModel.gemini.url.startsWith("https://gemini.google.com"), "glic look-alike must not win");

  const human = await runCli(["--port", String(server.port), "list"]);
  assert.match(human.stderr, /5 位议员全部在线/);
});

test("ask sends the prompt, waits for stability and prints only the reply", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-ask-"));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));

  const res = await runCli([
    "--port", String(server.port),
    "ask", "千问", "写一个带 TTL 的 LRU Cache",
    "--poll", "0.05", "--stable", "3", "--timeout", "20",
    "--out", outDir,
  ]);

  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /REPLY: 写一个带 TTL 的 LRU Cache/);
  assert.ok(!res.stdout.includes("Sidebar"), "page chrome must be stripped from the answer");

  const methods = server.log.map((l) => l.method);
  assert.ok(methods.includes("Input.insertText"), "prompt must be typed via CDP");
  assert.ok(methods.includes("Input.dispatchKeyEvent"), "Enter must be dispatched");
  assert.ok(
    server.log.some((l) => l.params && l.params.awaitPromise === false),
    "every Runtime.evaluate must set awaitPromise:false"
  );

  const files = fs.readdirSync(outDir);
  assert.equal(files.length, 1, "answer saved to the out dir");
  assert.match(files[0], /^hermes-ask-qwen-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/);
});

test("ask --json emits a machine-readable envelope", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const res = await runCli([
    "--port", String(server.port),
    "ask", "grok", "--json", "--no-save", "--poll", "0.05", "search something",
  ]);
  assert.equal(res.code, 0, res.stderr);
  const payload = JSON.parse(res.stdout);
  assert.equal(payload.model, "grok");
  assert.equal(payload.status, "ok");
  assert.equal(payload.file, null);
  assert.match(payload.answer, /REPLY: search something/);
  assert.ok(payload.polls >= 3, "must poll at least stableCount times");
});

test("prompt can be piped through stdin", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const res = await runCli(
    ["--port", String(server.port), "ask", "arena", "--no-save", "--poll", "0.05", "-"],
    { stdin: "review this patch" }
  );
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /REPLY: review this patch/);
});

test("read returns the current page text", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const res = await runCli(["--port", String(server.port), "read", "清言"]);
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /History for 智谱清言/, "reads the ChatGLM tab, not another one");

  const tailed = await runCli(["--port", String(server.port), "read", "清言", "--tail", "5", "--json"]);
  const payload = JSON.parse(tailed.stdout);
  assert.equal(payload.model, "chatglm");
  assert.ok(payload.text.length <= 5);
});

test("doctor reports a healthy parliament and flags TCP failures", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const ok = await runCli(["--port", String(server.port), "doctor"]);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stderr, /TCP 连通: ✅/);
  assert.equal((ok.stderr.match(/✅ 🧠|✅ 🔍|✅ 💬|✅ 🤝|✅ ✍️/g) || []).length, 5, "all five members found");

  const down = await runCli(["--port", "1", "doctor"]);
  assert.equal(down.code, 4);
  assert.match(down.stderr, /--remote-debugging-port=1/);
});

test("unknown model exits 3 with a helpful hint", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());

  const res = await runCli(["--port", String(server.port), "ask", "claude", "hello"]);
  assert.equal(res.code, 3);
  assert.match(res.stderr, /未找到模型 "claude"/);
  assert.match(res.stderr, /list/);
});

test("missing prompt exits 2", async (t) => {
  const server = await MockCdp.start();
  t.after(() => server.close());
  const res = await runCli(["--port", String(server.port), "ask", "grok"]);
  assert.equal(res.code, 2);
});

test("an unreachable CDP endpoint exits 4", async () => {
  const res = await runCli(["--port", "1", "list"]);
  assert.equal(res.code, 4);
  assert.match(res.stderr, /无法连接 Tabbit CDP/);
});

test("transient HTTP 503 from /json is retried", async (t) => {
  const server = await MockCdp.start({ failJson: true });
  t.after(() => server.close());
  const res = await runCli(["--port", String(server.port), "list", "--json"]);
  assert.equal(res.code, 0, res.stderr);
  assert.ok(server.jsonHits >= 2, "should have retried after the first 503");
});

test("--help and --version work without a browser", async () => {
  const help = await runCli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /hermes-tools v|用法/);
  const ver = await runCli(["--version"]);
  assert.equal(ver.code, 0);
  assert.match(ver.stdout.trim(), /^hermes-tools v\d+\.\d+\.\d+$/);
});
