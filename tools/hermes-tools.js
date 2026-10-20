#!/usr/bin/env node
/**
 * hermes-tools.js — Hermes 的手 / Hermes's hands
 * ------------------------------------------------------------------
 * Control 5 AI model tabs inside Tabbit Browser over the Chrome
 * DevTools Protocol (CDP). No npm dependencies: Node >= 22 ships a
 * global `WebSocket` and `fetch`.
 *
 * Commands
 *   models                       Show the model registry (roles + matchers)
 *   list                         List browser tabs and the model each maps to
 *   ask <model> <prompt>         New chat -> send -> wait for completion -> read
 *   read <model>                 Read the current page text
 *   new  <model>                 Open a fresh conversation
 *   doctor                       Diagnose the CDP connection and model tabs
 *
 * Exit codes
 *   0 ok   2 usage   3 model/tab not found   4 CDP unreachable   5 timeout/no answer
 *
 * stdout = data (the answer, or JSON)   stderr = progress logs
 * ------------------------------------------------------------------
 */

"use strict";

const net = require("net");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VERSION = "2.0.0";

// ────────────────────────────────────────────────────────────────
// Model registry — one entry per parliament member.
// `match` decides which tab belongs to a model; `exclude` guards
// against look-alikes (e.g. chrome://glic/ titles contain "Gemini").
// ────────────────────────────────────────────────────────────────

const MODELS = [
  {
    id: "gemini",
    emoji: "🧠",
    role: "议长 / Speaker",
    duty: "综合多方观点、做最终决策 / synthesize views, final decision",
    aliases: ["gemini", "议长", "speaker"],
    match: {
      url: [/gemini\.google\.com/i, /\bgemini\b/i],
      title: [/gemini/i],
    },
    exclude: [/^chrome:\/\//i, /glic/i, /^devtools:/i],
    newChat: { labels: ["New chat", "新建聊天", "新聊天"], nth: 1 },
    input: ['[contenteditable="true"][role="textbox"]', 'textarea', '[contenteditable="true"]'],
  },
  {
    id: "grok",
    emoji: "🔍",
    role: "研究员 / Researcher",
    duty: "搜索事实、找库、纠正错误假设 / search facts, correct assumptions",
    aliases: ["grok", "研究员", "researcher"],
    match: {
      url: [/grok\.com/i, /\bgrok\b/i],
      title: [/grok/i],
    },
    exclude: [/^chrome:\/\//i, /^devtools:/i],
    newChat: { labels: ["新建聊天", "New chat", "New Chat"], nth: 1 },
    input: ['[contenteditable="true"][role="textbox"]', 'textarea', '[contenteditable="true"]'],
  },
  {
    id: "qwen",
    emoji: "💬",
    role: "工程师 / Engineer",
    duty: "方案设计、代码实现 / design solutions, write code",
    aliases: ["qwen", "qianwen", "千问", "通义", "工程师", "engineer"],
    match: {
      url: [/qwen\.ai/i, /qianwen/i, /tongyi/i, /chat\.qwen/i],
      title: [/千问|通义|qwen/i],
    },
    exclude: [/^chrome:\/\//i, /^devtools:/i],
    newChat: { labels: ["新建对话", "新对话", "New chat"], nth: 1 },
    input: ['[contenteditable="true"][role="textbox"]', 'textarea', '[contenteditable="true"]'],
  },
  {
    id: "arena",
    emoji: "🤝",
    role: "评审官 / Reviewer",
    duty: "审计方案、挑漏洞、安全审查 / audit, find holes, security review",
    aliases: ["arena", "arena.ai", "评审", "评审官", "reviewer", "sonnet"],
    match: {
      url: [/arena\.ai/i, /\barena\b/i],
      title: [/arena/i],
    },
    exclude: [/^chrome:\/\//i, /^devtools:/i],
    newChat: { labels: ["New Chat", "New chat", "新对话"], nth: 1 },
    input: ['textarea', '[contenteditable="true"][role="textbox"]', '[contenteditable="true"]'],
  },
  {
    id: "chatglm",
    emoji: "✍️",
    role: "书记员 / Scribe",
    duty: "执笔最终代码与文档 / write final code and docs",
    aliases: ["chatglm", "glm", "清言", "智谱", "书记员", "scribe"],
    match: {
      url: [/chatglm\.cn/i, /bigmodel\.cn/i, /zhipu/i, /chatglm/i],
      title: [/清言|智谱|chatglm|glm/i],
    },
    exclude: [/^chrome:\/\//i, /^devtools:/i],
    // Sidebar starts collapsed: expand first, then the SECOND 新对话 node is the composer-ish one.
    newChat: { expand: ["展开"], labels: ["新对话", "新建对话"], nth: 2, fallbackNth: 1 },
    input: ['[contenteditable="true"][role="textbox"]', 'textarea', '[contenteditable="true"]'],
  },
];

const DEFAULT_INPUT_SELECTORS = [
  '[contenteditable="true"][role="textbox"]',
  "textarea",
  '[contenteditable="true"]',
];

const INTERNAL_URL = /^(chrome|chrome-extension|devtools|edge|about|view-source):/i;

// ────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested — see test/hermes-tools.test.js)
// ────────────────────────────────────────────────────────────────

const normalize = (s) => String(s || "").toLowerCase().trim();

const isInternalPage = (page) => INTERNAL_URL.test(String(page.url || ""));

function findRegistryEntry(query) {
  const q = normalize(query);
  if (!q) return null;
  return (
    MODELS.find((m) => m.id === q) ||
    MODELS.find((m) => m.aliases.some((a) => normalize(a) === q)) ||
    null
  );
}

function entryMatchesPage(page, entry) {
  const url = String(page.url || "");
  const title = String(page.title || "");
  if (entry.exclude && entry.exclude.some((re) => re.test(url) || re.test(title))) return false;
  const urlHit = entry.match.url.some((re) => re.test(url));
  const titleHit = entry.match.title.some((re) => re.test(title));
  return urlHit || titleHit;
}

/**
 * Resolve a user-supplied keyword ("千问", "grok", …) to a browser tab.
 * Order: registry alias -> registry url/title match -> generic substring.
 */
function resolveModel(pages, query) {
  const all = Array.isArray(pages) ? pages : [];
  const pagesOnly = all.filter((p) => p.type === "page" || p.type === undefined);
  const entry = findRegistryEntry(query);

  if (entry) {
    const hits = pagesOnly.filter((p) => entryMatchesPage(p, entry));
    if (hits.length) return { entry, page: hits[0] };
  }

  const q = normalize(query);
  if (q) {
    const generic = pagesOnly
      .filter((p) => !isInternalPage(p))
      .filter((p) => normalize(`${p.title || ""} ${p.url || ""}`).includes(q));
    if (generic.length) return { entry: entry || null, page: generic[0] };
  }
  return null;
}

/** Best-effort role label for an arbitrary tab (used by `list`). */
function describePage(page) {
  const entry = MODELS.find((m) => entryMatchesPage(page, m));
  if (entry) return { entry, known: true };
  if (isInternalPage(page)) return { entry: null, known: false, internal: true };
  return { entry: null, known: false };
}

/**
 * Decide whether a model has finished answering.
 * `samples` = [{ text, streaming }] in poll order.
 * Stable for `stableCount` polls AND not streaming => done.
 * Stable for 2x `stableCount` polls => done anyway (stability beats a
 * stuck streaming indicator, so a buggy detector can only cost time,
 * never correctness).
 */
function isComplete(samples, opts = {}) {
  const need = Math.max(1, opts.stableCount || 3);
  const list = Array.isArray(samples) ? samples : [];
  if (list.length < need) return { done: false };

  const win = list.slice(-need);
  const stable = win.every((s) => s.text === win[0].text) && win[0].text.length > 0;
  if (!stable) return { done: false, stable: false };

  const streaming = win.some((s) => s.streaming);
  if (!streaming) return { done: true, stable: true, streaming: false, reason: "stable" };

  const longWin = list.slice(-need * 2);
  const longStable =
    longWin.length >= need * 2 && longWin.every((s) => s.text === longWin[0].text);
  if (longStable) return { done: true, stable: true, streaming: true, reason: "stable-override" };
  return { done: false, stable: true, streaming: true };
}

/**
 * Strip the pre-prompt page text off a full page read so the answer is
 * the model's reply only — not the whole sidebar/SPI chrome.
 */
function extractAnswer(fullText, baseline = "", opts = {}) {
  const tail = Number(opts.tail || 0);
  const full = String(fullText || "");
  const base = String(baseline || "");
  let answer = full;

  if (base && full.length >= base.length && full.slice(0, Math.min(base.length, 400)) === base.slice(0, Math.min(base.length, 400))) {
    answer = full.slice(base.length);
  } else if (base) {
    // Page grew/changed shape (SPA re-render) — locate the tail of the old
    // text inside the new one and keep everything after it.
    const needleLen = Math.min(200, base.length);
    const needle = base.slice(-needleLen);
    const idx = full.indexOf(needle);
    answer = idx >= 0 ? full.slice(idx + needleLen) : full;
  }

  answer = answer.replace(/^[\s\n]+/, "");
  if (tail > 0 && answer.length > tail) answer = answer.slice(-tail);
  return answer;
}

/** Split a prompt into CDP-sized chunks (Input.insertText has practical limits). */
function chunkText(text, size = 3000) {
  const s = Math.max(1, size);
  const out = [];
  for (let i = 0; i < text.length; i += s) out.push(text.slice(i, i + s));
  return out.length ? out : [""];
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const body = a.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) flags[body.slice(0, eq)] = body.slice(eq + 1);
      else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[body] = next;
          i++;
        } else flags[body] = true;
      }
    } else positional.push(a);
  }
  return { flags, positional };
}

const num = (v, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};
const bool = (v) => v === true || v === "true" || v === "1" || v === "" || v === "yes";

// ────────────────────────────────────────────────────────────────
// CDP plumbing
// ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CdpError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.name = "CdpError";
    this.exitCode = code;
  }
}

class Session {
  constructor(ws, sessionId) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
    this.onMessage = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new CdpError(`${msg.error.message || "CDP error"} (code ${msg.error.code})`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", (ev) => this.onMessage(ev.data));
  }

  send(method, params = {}, timeoutMs = 15000) {
    if (this.closed) return Promise.reject(new CdpError("session closed"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CdpError(`CDP timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, sessionId: this.sessionId, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /** SPA-safe evaluate: never await promises, never block on a busy main thread. */
  async evaluate(expression, { timeoutMs = 10000, returnByValue = true } = {}) {
    const res = await this.send(
      "Runtime.evaluate",
      { expression, returnByValue, awaitPromise: false, userGesture: true },
      timeoutMs
    );
    if (res && res.exceptionDetails) {
      const ex = res.exceptionDetails;
      throw new CdpError(`page error: ${(ex.exception && ex.exception.description) || ex.text}`);
    }
    return res ? res.result && res.result.value : undefined;
  }

  close() {
    this.closed = true;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new CdpError("session closed"));
    }
    this.pending.clear();
  }
}

class Browser {
  constructor(ws, baseUrl) {
    this.ws = ws;
    this.baseUrl = baseUrl;
    this.sessions = new Set();
  }

  static async connect({ host = "127.0.0.1", port = 9222, timeoutMs = 5000 } = {}) {
    const baseUrl = `http://${host}:${port}`;
    let version;
    try {
      version = await httpJson(`${baseUrl}/json/version`, { timeoutMs });
    } catch (err) {
      throw new CdpError(
        `无法连接 Tabbit CDP (${baseUrl}) — ${err.message}\n` +
          `  启动方式: "Tabbit Browser.exe" --remote-debugging-port=${port} --restore-last-session`,
        4
      );
    }
    const wsUrl = version.webSocketDebuggerUrl;
    if (!wsUrl) throw new CdpError("CDP /json/version 未返回 webSocketDebuggerUrl", 4);

    const ws = await new Promise((resolve, reject) => {
      let socket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        reject(new CdpError(`WebSocket 创建失败: ${err.message}`, 4));
        return;
      }
      const t = setTimeout(() => reject(new CdpError("WebSocket 连接超时", 4)), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(t);
        resolve(socket);
      });
      socket.addEventListener("error", () => {
        clearTimeout(t);
        reject(new CdpError("WebSocket 连接失败", 4));
      });
    });

    return new Browser(ws, baseUrl);
  }

  /** /json is rate-limited (503 under rapid polling) — retry with backoff. */
  async targets({ retries = 3, timeoutMs = 5000 } = {}) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        const list = await httpJson(`${this.baseUrl}/json`, { timeoutMs });
        return list.filter((t) => t.type === "page");
      } catch (err) {
        lastErr = err;
        if (i < retries) await sleep(400 * (i + 1));
      }
    }
    throw new CdpError(`无法列出标签页: ${lastErr && lastErr.message}`, 4);
  }

  async attach(targetId) {
    const res = await new Promise((resolve, reject) => {
      const id = 1;
      const timer = setTimeout(() => reject(new CdpError("attach timeout")), 10000);
      const handler = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.id === id) {
          clearTimeout(timer);
          this.ws.removeEventListener("message", handler);
          if (msg.error) reject(new CdpError(msg.error.message || "attach failed"));
          else resolve(msg.result);
        }
      };
      this.ws.addEventListener("message", handler);
      this.ws.send(JSON.stringify({ id, method: "Target.attachToTarget", params: { targetId, flatten: true } }));
    });
    const session = new Session(this.ws, res.sessionId);
    this.sessions.add(session);
    return session;
  }

  close() {
    for (const s of this.sessions) {
      s.close();
      try {
        this.ws.send(
          JSON.stringify({ id: Number.MAX_SAFE_INTEGER, method: "Target.detachFromTarget", params: { sessionId: s.sessionId } })
        );
      } catch {}
    }
    this.sessions.clear();
    try {
      this.ws.close();
    } catch {}
  }
}

function httpJson(url, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = httpRequest(url, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`JSON 解析失败 (${url}): ${err.message}`));
          }
        });
      });
    } catch (err) {
      reject(err);
      return;
    }
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on("error", reject);
  });
}

function httpRequest(url, cb) {
  // Node >= 22 has a global fetch, but the HTTP module gives us a hard
  // timeout knob and behaves identically on Node 18+.
  return http.get(url, cb);
}

// ────────────────────────────────────────────────────────────────
// In-page scripts (stringified and evaluated in the tab)
// ────────────────────────────────────────────────────────────────

function clickByTextFn(spec) {
  const labels = spec.labels || [];
  const nth = spec.nth || 1;
  const maxLen = spec.maxLen || 30;
  const selectors = 'button,a,[role="button"],div[role="button"],span,li,label,div';
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const nodes = Array.from(document.querySelectorAll(selectors));
  const hits = [];
  for (const el of nodes) {
    const text = (el.textContent || "").trim();
    const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
    const title = (el.getAttribute && el.getAttribute("title")) || "";
    if (!labels.some((l) => text.includes(l) || aria.includes(l) || title.includes(l))) continue;
    if (text.length > maxLen && !aria && !title) continue;
    if (!visible(el)) continue;
    // Prefer the innermost element that owns the text (avoid giant containers).
    hits.push(el);
  }
  if (!hits.length) return { ok: false, reason: "not-found", matches: 0 };
  const idx = Math.min(hits.length, nth) - 1;
  const el = hits[idx];
  try {
    el.scrollIntoView({ block: "center" });
  } catch {}
  el.click();
  return { ok: true, matches: hits.length, index: idx, text: (el.textContent || "").trim().slice(0, 40) };
}

function focusInputFn(spec) {
  const selectors = (spec && spec.selectors) || [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  for (const sel of selectors) {
    let nodes = [];
    try {
      nodes = Array.from(document.querySelectorAll(sel));
    } catch {
      continue;
    }
    nodes = nodes.filter(visible);
    if (!nodes.length) continue;
    nodes.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    const el = nodes[0];
    try {
      el.scrollIntoView({ block: "center" });
      el.focus();
      if (typeof el.click === "function") el.click();
      el.focus();
      return { ok: true, selector: sel, tag: el.tagName, count: nodes.length };
    } catch (err) {
      return { ok: false, selector: sel, error: String(err && err.message) };
    }
  }
  return { ok: false, reason: "no-input" };
}

function streamingFn() {
  const hints = ["停止", "停止生成", "Stop generating", "Pause response", "暂停"];
  const nodes = Array.from(document.querySelectorAll("button,[aria-label],[data-testid]"));
  for (const el of nodes) {
    const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
    const text = (el.textContent || "").trim();
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    for (const h of hints) {
      if (aria.includes(h)) return true;
      if (text.length <= 20 && text.includes(h)) return true;
    }
  }
  return false;
}

const PAGE_TEXT_EXPR = "document.documentElement.innerText";

// ────────────────────────────────────────────────────────────────
// High-level operations
// ────────────────────────────────────────────────────────────────

async function readPageText(session) {
  try {
    const v = await session.evaluate(PAGE_TEXT_EXPR, { timeoutMs: 10000 });
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

/** Open a fresh conversation using the model-specific strategy. */
async function newChat(session, entry, { log = () => {} } = {}) {
  const spec = (entry && entry.newChat) || { labels: ["新对话", "New chat", "New Chat"], nth: 1 };
  const labels = spec.labels || [];

  if (spec.expand && spec.expand.length) {
    const expanded = await session.evaluate(`(${clickByTextFn.toString()})(${JSON.stringify({ labels: spec.expand, nth: 1, maxLen: 12 })})`);
    if (expanded && expanded.ok) {
      log(`   侧边栏已展开 (${expanded.text})`);
      await sleep(700);
    }
  }

  const attempt = async (nth) => {
    const res = await session.evaluate(
      `(${clickByTextFn.toString()})(${JSON.stringify({ labels, nth, maxLen: spec.maxLen || 30 })})`
    );
    return res || { ok: false };
  };

  let res = await attempt(spec.nth || 1);
  if (!res.ok && spec.fallbackNth) res = await attempt(spec.fallbackNth);
  if (!res.ok && (spec.nth || 1) !== 1) res = await attempt(1);
  await sleep(900);
  return res;
}

async function typePrompt(session, prompt, { chunk = 3000, delay = 45 } = {}) {
  const chunks = chunkText(prompt, chunk);
  for (const c of chunks) {
    await session.send("Input.insertText", { text: c }, 15000);
    await sleep(delay);
  }
}

async function pressEnter(session) {
  const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key, text: "\r" }, 10000);
  await sleep(180);
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", ...key }, 10000);
}

/**
 * Send a prompt and wait for the model to finish.
 * Returns { status: "ok" | "timeout" | "no-response", answer, full, elapsedMs, polls }
 */
async function askModel(browser, page, entry, prompt, opts = {}) {
  const log = opts.log || (() => {});
  const timeoutMs = (opts.timeout || 180) * 1000;
  const pollMs = (opts.poll || 2) * 1000;
  const stableCount = opts.stableCount || 3;
  const detectStream = opts.streamDetect !== false;

  const session = await browser.attach(page.id);
  try {
    if (opts.focus !== false) {
      try {
        await session.send("Page.bringToFront", {}, 8000);
      } catch {}
      await sleep(250);
    }

    if (opts.newChat !== false) {
      const res = await newChat(session, entry, { log });
      log(`   🆕 新对话: ${res.ok ? `clicked "${res.text}"` : "未找到按钮(继续)"}`);
    }

    const baseline = await readPageText(session);
    log(`   📏 基线文本 ${baseline.length} chars`);

    const focused = await session.evaluate(
      `(${focusInputFn.toString()})(${JSON.stringify({
        selectors: (entry && entry.input) || DEFAULT_INPUT_SELECTORS,
      })})`
    );
    if (!focused || !focused.ok) {
      throw new CdpError(`未找到输入框 (${page.title}) — 页面可能需要登录或结构已变化`, 5);
    }
    log(`   🎯 输入框: ${focused.selector}`);

    await typePrompt(session, prompt, { chunk: opts.chunk, delay: opts.typeDelay });
    await pressEnter(session);
    log(`   📤 已发送 ${prompt.length} chars，等待回复…`);

    const samples = [];
    const started = Date.now();
    let full = baseline;
    let grew = false;

    while (Date.now() - started < timeoutMs) {
      await sleep(pollMs);
      const text = await readPageText(session);
      const streaming = detectStream ? Boolean(await session.evaluate(`(${streamingFn.toString()})()`, { timeoutMs: 8000 }).catch(() => false)) : false;
      if (text.length > baseline.length + 20 || text !== baseline) grew = true;
      samples.push({ text, streaming });
      full = text;
      const verdict = isComplete(samples, { stableCount });
      const secs = Math.round((Date.now() - started) / 1000);
      log(`   ⏳ ${secs}s · ${text.length} chars${streaming ? " · 生成中" : ""}`);
      if (grew && verdict.done) {
        return {
          status: "ok",
          answer: extractAnswer(text, baseline, { tail: opts.tail }),
          full: text,
          elapsedMs: Date.now() - started,
          polls: samples.length,
          reason: verdict.reason,
        };
      }
    }

    return {
      status: grew ? "timeout" : "no-response",
      answer: extractAnswer(full, baseline, { tail: opts.tail }),
      full,
      elapsedMs: Date.now() - started,
      polls: samples.length,
      reason: "timeout",
    };
  } finally {
    session.close();
    browser.sessions.delete(session);
  }
}

// ────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────

const HELP = `
🧠 Hermes Tabbit Parliament — tools v${VERSION}

用法 / Usage
  node tools/hermes-tools.js <command> [options]

命令 / Commands
  models                     显示模型注册表（角色与匹配规则）
  list                       列出浏览器标签页及其议会角色
  ask <模型> <提示>           新建对话 → 发送 → 等待完成 → 读取回复
  read <模型>                 读取当前页面文本
  new  <模型>                 新建对话
  doctor                     诊断 CDP 连接与模型标签页

常用选项 / Options
  --port <n>               CDP 端口 (default 9222, env TABBIT_CDP_PORT)
  --host <addr>            CDP 主机 (default 127.0.0.1)
  --timeout <sec>          等待回复上限 (default 180)
  --poll <sec>             轮询间隔 (default 2)
  --stable <n>             连续 n 次文本不变视为完成 (default 3)
  --no-new                 不新建对话，直接追加到当前会话
  --no-focus               不调用 Page.bringToFront
  --no-stream-detect       关闭“生成中”指示灯检测
  --tail <n>               只保留回复末尾 n 个字符
  --out <dir>              回复保存目录 (default out/)
  --no-save                不保存到文件
  --json                   以 JSON 输出到 stdout
  -                        从 stdin 读取提示词

示例 / Examples
  node tools/hermes-tools.js list
  node tools/hermes-tools.js ask 千问 "写一个带 TTL 的 Python LRU Cache"
  echo "审查这段代码" | node tools/hermes-tools.js ask arena --json -
  node tools/hermes-tools.js ask gemini "综合三方意见做决策" --timeout 300 --stable 4

退出码 / Exit codes
  0 成功   2 用法错误   3 未找到模型/标签   4 CDP 不可达   5 超时或无回复
`;

function log(...args) {
  process.stderr.write(args.join(" ") + "\n");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function saveAnswer(dir, modelId, text) {
  const target = path.resolve(dir);
  fs.mkdirSync(target, { recursive: true });
  const file = path.join(target, `hermes-ask-${modelId}-${timestamp()}.md`);
  fs.writeFileSync(file, text, "utf8");
  return file;
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

function cdpHopts(flags) {
  return {
    host: typeof flags.host === "string" ? flags.host : process.env.TABBIT_CDP_HOST || "127.0.0.1",
    port: num(flags.port, num(process.env.TABBIT_CDP_PORT, 9222)),
  };
}

async function withBrowser(flags, fn) {
  const browser = await Browser.connect(cdpHopts(flags));
  try {
    return await fn(browser);
  } finally {
    browser.close();
  }
}

async function cmdModels() {
  log("\n🏛️  议会成员 / Parliament members\n");
  for (const m of MODELS) {
    log(`  ${m.emoji} ${m.id.padEnd(8)} ${m.role}`);
    log(`     ${m.duty}`);
    log(`     别名: ${m.aliases.join(", ")}\n`);
  }
}

async function cmdList(browser, flags) {
  const pages = await browser.targets();
  const rows = pages.map((p) => {
    const d = describePage(p);
    return {
      model: d.entry ? d.entry.id : null,
      emoji: d.entry ? d.entry.emoji : d.internal ? "⚙️" : "📄",
      role: d.entry ? d.entry.role : d.internal ? "浏览器内部页面" : "未知站点",
      title: p.title || "(无标题)",
      url: p.url || "",
      id: p.id,
    };
  });

  const missing = MODELS.filter((m) => !rows.some((r) => r.model === m.id)).map((m) => m.id);

  if (bool(flags.json)) {
    process.stdout.write(JSON.stringify({ count: rows.length, missing, tabs: rows }, null, 2) + "\n");
    return 0;
  }

  log(`\n  Tabbit — ${rows.length} 个标签页\n`);
  for (const r of rows) {
    log(`  ${r.emoji} ${r.model || "—"} ${r.role !== "未知站点" ? "· " + r.role : ""}`);
    log(`     ${r.title.slice(0, 70)}`);
    log(`     ${r.url.slice(0, 80)}`);
    log(`     id=${r.id.slice(0, 12)}\n`);
  }

  if (missing.length) log(`  ⚠️  未检测到: ${missing.join(", ")}\n`);
  else log(`  ✅ ${MODELS.length} 位议员全部在线\n`);
  return 0;
}

async function cmdAsk(browser, flags, positional) {
  const kw = positional[0];
  let prompt = positional.slice(1).join(" ").trim();
  if (!kw) throw new CdpError("缺少模型参数: ask <模型> <提示>", 2);
  if (!prompt || prompt === "-") {
    const piped = (await readStdin()).trim();
    if (piped) prompt = piped;
  }
  if (!prompt) throw new CdpError("缺少提示词（命令行参数或 stdin）", 2);

  const pages = await browser.targets();
  const hit = resolveModel(pages, kw);
  if (!hit) throw new CdpError(`未找到模型 "${kw}" — 先运行 list 查看在线标签`, 3);
  const { entry, page } = hit;

  log(`\n  📤 ${entry ? entry.emoji + " " + entry.id : "📄"} → ${page.title.slice(0, 60)}`);
  log(`  📝 ${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}\n`);

  const result = await askModel(browser, page, entry, prompt, {
    timeout: num(flags.timeout, 180),
    poll: num(flags.poll, 2),
    stableCount: num(flags.stable, 3),
    newChat: !bool(flags["no-new"]),
    focus: !bool(flags["no-focus"]),
    streamDetect: !bool(flags["no-stream-detect"]),
    tail: num(flags.tail, 0),
    chunk: num(flags.chunk, 3000),
    typeDelay: num(flags["type-delay"], 45),
    log: (m) => log(m),
  });

  let file = null;
  if (!bool(flags["no-save"])) {
    const dir = typeof flags.out === "string" ? flags.out : "out";
    try {
      file = saveAnswer(dir, entry ? entry.id : "unknown", result.answer || result.full);
    } catch (err) {
      log(`  ⚠️  保存失败: ${err.message}`);
    }
  }

  if (bool(flags.json)) {
    process.stdout.write(
      JSON.stringify(
        {
          model: entry ? entry.id : null,
          title: page.title,
          url: page.url,
          status: result.status,
          reason: result.reason,
          chars: (result.answer || "").length,
          elapsedMs: result.elapsedMs,
          polls: result.polls,
          file,
          answer: result.answer,
        },
        null,
        2
      ) + "\n"
    );
  } else {
    process.stdout.write((result.answer || "") + "\n");
  }

  log(`\n  ${result.status === "ok" ? "✅" : "⚠️ "} ${result.status} · ${(result.answer || "").length} chars · ${Math.round(result.elapsedMs / 1000)}s · ${result.polls} polls`);
  if (result.status === "timeout") log("  💡 模型可能仍在生成 —— 加大 --timeout，或用 --stable 2 提前收尾");
  if (result.status === "no-response") log("  💡 页面文本没有变化 —— 检查该模型是否已登录、输入框选择器是否仍匹配");
  if (file) log(`  💾 ${file}\n`);

  return result.status === "ok" ? 0 : 5;
}

async function cmdRead(browser, flags, positional) {
  const kw = positional[0];
  if (!kw) throw new CdpError("缺少模型参数: read <模型>", 2);
  const pages = await browser.targets();
  const hit = resolveModel(pages, kw);
  if (!hit) throw new CdpError(`未找到模型 "${kw}"`, 3);

  const session = await browser.attach(hit.page.id);
  let text = "";
  try {
    text = await readPageText(session);
  } finally {
    session.close();
    browser.sessions.delete(session);
  }

  const tail = num(flags.tail, 0);
  const out = tail > 0 && text.length > tail ? text.slice(-tail) : text;

  if (bool(flags.json)) {
    process.stdout.write(JSON.stringify({ model: hit.entry ? hit.entry.id : null, title: hit.page.title, chars: text.length, text: out }, null, 2) + "\n");
  } else {
    process.stdout.write(out + "\n");
  }
  return 0;
}

async function cmdNew(browser, flags, positional) {
  const kw = positional[0];
  if (!kw) throw new CdpError("缺少模型参数: new <模型>", 2);
  const pages = await browser.targets();
  const hit = resolveModel(pages, kw);
  if (!hit) throw new CdpError(`未找到模型 "${kw}"`, 3);

  const session = await browser.attach(hit.page.id);
  try {
    const res = await newChat(session, hit.entry, { log: (m) => log(m) });
    if (bool(flags.json)) process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    else log(`  🆕 ${hit.page.title}: ${res.ok ? `clicked "${res.text}"` : "未找到新对话按钮"}`);
    return res.ok ? 0 : 5;
  } finally {
    session.close();
    browser.sessions.delete(session);
  }
}

async function cmdDoctor(flags) {
  const { host, port } = cdpHopts(flags);
  log(`\n🩺 Hermes Parliament — 诊断\n`);
  log(`  CDP 端点: http://${host}:${port}`);

  const tcp = await new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (ok) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(3000);
    s.on("connect", () => done(true));
    s.on("timeout", () => done(false));
    s.on("error", () => done(false));
  });
  log(`  TCP 连通: ${tcp ? "✅" : "❌"}`);
  if (!tcp) {
    log(`\n  Tabbit 未开启调试端口。启动方式:`);
    log(`    taskkill.exe //F //IM "Tabbit Browser.exe"`);
    log(`    "…\\Tabbit Browser.exe" --remote-debugging-port=${port} --restore-last-session\n`);
    return 4;
  }

  return withBrowser(flags, async (browser) => {
    const ver = await httpJson(`${browser.baseUrl}/json/version`).catch(() => null);
    if (ver) log(`  浏览器: ${ver.Browser}`);
    const pages = await browser.targets();
    const rows = pages.map((p) => ({ page: p, info: describePage(p) }));
    log(`  标签页: ${rows.length} (内部页面 ${rows.filter((r) => r.info.internal).length})\n`);

    for (const m of MODELS) {
      const hits = rows.filter((r) => r.info.entry && r.info.entry.id === m.id);
      if (hits.length === 1) log(`  ✅ ${m.emoji} ${m.id.padEnd(8)} ${hits[0].page.title.slice(0, 50)}`);
      else if (hits.length > 1) log(`  ⚠️  ${m.emoji} ${m.id.padEnd(8)} ${hits.length} 个标签页匹配（将使用第一个）`);
      else log(`  ❌ ${m.emoji} ${m.id.padEnd(8)} 未找到标签页`);
    }

    const unknown = rows.filter((r) => !r.info.entry && !r.info.internal);
    if (unknown.length) {
      log(`\n  📄 未识别的站点 (${unknown.length}):`);
      for (const r of unknown.slice(0, 10)) log(`     ${(r.page.title || "").slice(0, 50)} — ${(r.page.url || "").slice(0, 60)}`);
      log(`     → 若需支持，在 MODELS 中为该站点添加匹配规则`);
    }
    log("");
    return 0;
  });
}

async function main(argv = process.argv.slice(2)) {
  const { flags, positional } = parseArgs(argv);
  const cmd = (positional[0] || "").toLowerCase();
  const rest = positional.slice(1);

  if (bool(flags.version) || bool(flags.v)) {
    process.stdout.write(`hermes-tools v${VERSION}\n`);
    return 0;
  }

  const asked = bool(flags.help) || bool(flags.h) || cmd === "help";
  if (asked || !cmd) {
    process.stdout.write(HELP);
    return asked ? 0 : 2;
  }

  switch (cmd) {
    case "models":
      await cmdModels();
      return 0;
    case "doctor":
      return cmdDoctor(flags);
    case "list":
    case "ls":
      return withBrowser(flags, (b) => cmdList(b, flags));
    case "ask":
      return withBrowser(flags, (b) => cmdAsk(b, flags, rest));
    case "read":
      return withBrowser(flags, (b) => cmdRead(b, flags, rest));
    case "new":
      return withBrowser(flags, (b) => cmdNew(b, flags, rest));
    default:
      log(`❌ 未知命令: ${cmd}`);
      process.stderr.write(HELP);
      return 2;
  }
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      const code = err && err.exitCode ? err.exitCode : 1;
      log(`\n❌ ${err && err.message ? err.message : err}`);
      process.exitCode = code;
    }
  );
}

module.exports = {
  VERSION,
  MODELS,
  DEFAULT_INPUT_SELECTORS,
  normalize,
  isInternalPage,
  findRegistryEntry,
  entryMatchesPage,
  resolveModel,
  describePage,
  isComplete,
  extractAnswer,
  chunkText,
  parseArgs,
  Browser,
  Session,
  CdpError,
  main,
  _internals: { clickByTextFn, focusInputFn, streamingFn },
};
