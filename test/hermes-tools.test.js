/**
 * Unit tests for the pure logic in tools/hermes-tools.js.
 * No browser required: run with `npm test` (node --test).
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MODELS,
  resolveModel,
  describePage,
  findRegistryEntry,
  isComplete,
  extractAnswer,
  chunkText,
  parseArgs,
  isInternalPage,
  normalize,
} = require("../tools/hermes-tools.js");

const page = (title, url, extra = {}) => ({ type: "page", id: "T" + Math.random().toString(36).slice(2, 8), title, url, ...extra });

const TABS = [
  page("Gemini", "https://gemini.google.com/app/abc"),
  page("Grok", "https://grok.com/?referrer=website"),
  page("千问", "https://chat.qwen.ai/"),
  page("Arena.ai", "https://arena.ai/chat"),
  page("智谱清言", "https://chatglm.cn/main/alltoolsdetail"),
  // Look-alikes that must never win:
  page("Gemini", "chrome://glic/blade/"),
  page("DevTools", "devtools://devtools/bundled/inspector.html"),
];

test("every model in the registry has the required fields", () => {
  for (const m of MODELS) {
    assert.ok(m.id && m.role && m.emoji, `${m.id} missing identity fields`);
    assert.ok(Array.isArray(m.aliases) && m.aliases.length, `${m.id} has no aliases`);
    assert.ok(m.match.url.length && m.match.title.length, `${m.id} has no matchers`);
    assert.ok(m.newChat && m.newChat.labels.length, `${m.id} has no new-chat labels`);
    assert.ok(Array.isArray(m.input) && m.input.length, `${m.id} has no input selectors`);
  }
  assert.equal(MODELS.length, 5, "parliament should have exactly 5 members");
});

test("resolves models by id, alias and Chinese name", () => {
  for (const [query, expected] of [
    ["gemini", "gemini"],
    ["Grok", "grok"],
    ["千问", "qwen"],
    ["qianwen", "qwen"],
    ["通义", "qwen"],
    ["arena", "arena"],
    ["评审官", "arena"],
    ["清言", "chatglm"],
    ["智谱", "chatglm"],
    ["chatglm", "chatglm"],
    ["研究员", "grok"],
  ]) {
    const hit = resolveModel(TABS, query);
    assert.ok(hit, `expected a hit for "${query}"`);
    assert.equal(hit.entry.id, expected, `"${query}" should resolve to ${expected}`);
    assert.ok(!isInternalPage(hit.page), `"${query}" must not resolve to an internal page`);
  }
});

test("never resolves Gemini to the chrome://glic/ look-alike", () => {
  const hit = resolveModel(TABS, "gemini");
  assert.equal(hit.page.url, "https://gemini.google.com/app/abc");
  assert.ok(!hit.page.url.startsWith("chrome://"));
});

test("falls back to a generic substring match for unknown sites", () => {
  const tabs = [...TABS, page("Perplexity", "https://www.perplexity.ai/")];
  const hit = resolveModel(tabs, "perplexity");
  assert.ok(hit);
  assert.equal(hit.entry, null, "unknown site has no registry entry");
  assert.match(hit.page.url, /perplexity/);
});

test("returns null when nothing matches", () => {
  assert.equal(resolveModel(TABS, "nonexistent-model-xyz"), null);
  assert.equal(resolveModel([], "gemini"), null);
});

test("describePage labels internal pages and parliament members", () => {
  assert.equal(describePage(page("Gemini", "chrome://glic/blade/")).internal, true);
  assert.equal(describePage(page("Gemini", "https://gemini.google.com/app")).entry.id, "gemini");
  const unknown = describePage(page("News", "https://example.com/news"));
  assert.equal(unknown.known, false);
  assert.equal(unknown.internal, undefined);
});

test("findRegistryEntry is case- and whitespace-insensitive", () => {
  assert.equal(findRegistryEntry("  QWEN ").id, "qwen");
  assert.equal(findRegistryEntry("nope"), null);
  assert.equal(normalize("  MiXeD Case "), "mixed case");
});

test("isComplete needs `stableCount` identical non-empty samples", () => {
  const opts = { stableCount: 3 };
  assert.equal(isComplete([{ text: "a", streaming: false }], opts).done, false);
  assert.equal(
    isComplete(
      [
        { text: "a", streaming: false },
        { text: "ab", streaming: false },
        { text: "abc", streaming: false },
      ],
      opts
    ).done,
    false,
    "growing text is not complete"
  );
  const stop = isComplete(
    [
      { text: "a", streaming: false },
      { text: "ab", streaming: false },
      { text: "ab", streaming: false },
      { text: "ab", streaming: false },
    ],
    opts
  );
  assert.equal(stop.done, true);
  assert.equal(stop.reason, "stable");
});

test("isComplete ignores empty pages", () => {
  const samples = [
    { text: "", streaming: false },
    { text: "", streaming: false },
    { text: "", streaming: false },
  ];
  assert.equal(isComplete(samples, { stableCount: 3 }).done, false);
});

test("a stuck streaming indicator is overridden by long stability", () => {
  const streamingSamples = Array.from({ length: 3 }, () => ({ text: "answer", streaming: true }));
  assert.equal(isComplete(streamingSamples, { stableCount: 3 }).done, false, "streaming delays completion");
  const longSamples = Array.from({ length: 6 }, () => ({ text: "answer", streaming: true }));
  const verdict = isComplete(longSamples, { stableCount: 3 });
  assert.equal(verdict.done, true, "2x stableCount wins over a broken detector");
  assert.equal(verdict.reason, "stable-override");
});

test("extractAnswer strips the pre-prompt page text", () => {
  const base = "sidebar\nhistory\n\n";
  const full = base + "The answer is 42.";
  assert.equal(extractAnswer(full, base), "The answer is 42.");
});

test("extractAnswer falls back to the tail delta after an SPA re-render", () => {
  const base = "sidebar history old-conversation";
  const full = "new header\nsidebar history old-conversation\nREPLY BODY";
  assert.equal(extractAnswer(full, base), "REPLY BODY");
});

test("extractAnswer honours --tail and empty baselines", () => {
  assert.equal(extractAnswer("abcdef", "", { tail: 3 }), "def");
  assert.equal(extractAnswer("abcdef", "", { tail: 0 }), "abcdef");
  assert.equal(extractAnswer("", ""), "");
  assert.equal(extractAnswer(undefined), "");
});

test("chunkText splits prompts and never loses characters", () => {
  const text = "x".repeat(7000);
  const chunks = chunkText(text, 3000);
  assert.deepEqual(chunks.map((c) => c.length), [3000, 3000, 1000]);
  assert.equal(chunks.join(""), text);
  assert.deepEqual(chunkText("", 3000), [""]);
  assert.deepEqual(chunkText("abc", 1), ["a", "b", "c"]);
});

test("parseArgs handles flags, values, terminators and positionals", () => {
  const { flags, positional } = parseArgs(["ask", "千问", "--timeout", "60", "--json", "--out=out/x", "--", "--not-a-flag"]);
  assert.equal(positional[0], "ask");
  assert.equal(positional[1], "千问");
  assert.deepEqual(positional.slice(2), ["--not-a-flag"]);
  assert.equal(flags.timeout, "60");
  assert.equal(flags.json, true);
  assert.equal(flags.out, "out/x");
});
