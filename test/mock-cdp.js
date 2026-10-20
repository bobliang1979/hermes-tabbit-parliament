/**
 * A tiny in-process mock of the Chrome DevTools Protocol endpoint.
 *
 * Zero dependencies (hand-rolled WebSocket framing) so the repo stays
 * dependency-free while still getting a real end-to-end test of the CLI:
 * HTTP /json + /json/version, WebSocket attach, Runtime.evaluate,
 * Input.insertText, Input.dispatchKeyEvent.
 *
 * Usage:
 *   const server = await MockCdp.start({ tabs: [...] });
 *   ...spawn the CLI with --port server.port...
 *   await server.close();
 */

"use strict";

const http = require("http");
const crypto = require("crypto");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const DEFAULT_TABS = [
  { id: "tab-gemini", title: "Gemini", url: "https://gemini.google.com/app/xyz" },
  { id: "tab-grok", title: "Grok", url: "https://grok.com/" },
  { id: "tab-qwen", title: "千问", url: "https://chat.qwen.ai/" },
  { id: "tab-arena", title: "Arena.ai", url: "https://arena.ai/chat" },
  { id: "tab-chatglm", title: "智谱清言", url: "https://chatglm.cn/main/detail" },
  { id: "tab-glic", title: "Gemini", url: "chrome://glic/blade/" },
];

// ── minimal WebSocket framing ───────────────────────────────────

function decodeFrames(buf) {
  const frames = [];
  let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off];
    const b1 = buf[off + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let head = 2;
    if (len === 126) {
      if (off + 4 > buf.length) break;
      len = buf.readUInt16BE(off + 2);
      head = 4;
    } else if (len === 127) {
      if (off + 10 > buf.length) break;
      len = Number(buf.readBigUInt64BE(off + 2));
      head = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (off + head + maskLen + len > buf.length) break;
    let payload = Buffer.alloc(len);
    if (masked) {
      const mask = buf.subarray(off + head, off + head + 4);
      const data = buf.subarray(off + head + 4, off + head + 4 + len);
      for (let i = 0; i < len; i++) payload[i] = data[i] ^ mask[i % 4];
    } else {
      buf.copy(payload, 0, off + head, off + head + len);
    }
    off += head + maskLen + len;
    frames.push({ opcode, payload });
  }
  return { frames, rest: buf.subarray(off) };
}

function encodeFrame(text) {
  const payload = Buffer.from(text, "utf8");
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x81; // FIN + text
  return Buffer.concat([header, payload]);
}

// ── the mock browser ────────────────────────────────────────────

class MockCdp {
  /**
   * @param {object} [opts]
   * @param {Array}  [opts.tabs]        tab descriptors
   * @param {number} [opts.streamSteps] how many polls the fake reply takes to "stream"
   * @param {boolean}[opts.failJson]    return 503 from /json to exercise retry
   */
  static start(opts = {}) {
    return new Promise((resolve, reject) => {
      const server = new MockCdp(opts);
      server.http.listen(0, "127.0.0.1", () => {
        server.port = server.http.address().port;
        resolve(server);
      });
      server.http.on("error", reject);
    });
  }

  constructor(opts = {}) {
    this.tabs = (opts.tabs || DEFAULT_TABS).map((t) => ({ ...t, type: "page" }));
    this.streamSteps = opts.streamSteps || 2;
    this.failJson = Boolean(opts.failJson);
    this.jsonHits = 0;
    this.state = new Map(); // tabId -> { text, buffer, pending, replies }
    for (const t of this.tabs) {
      this.state.set(t.id, { text: `Sidebar\nHistory for ${t.title}\n`, buffer: "", pending: [] });
    }
    this.sessions = new Map();
    this.log = []; // every CDP method the CLI called

    this.http = http.createServer((req, res) => this.handleHttp(req, res));
    this.http.on("upgrade", (req, socket) => this.handleUpgrade(req, socket));
  }

  handleHttp(req, res) {
    const url = (req.url || "").split("?")[0];
    if (url === "/json/version") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          Browser: "MockTabbit/1.0",
          webSocketDebuggerUrl: `ws://127.0.0.1:${this.http.address().port}/devtools/browser/mock`,
        })
      );
      return;
    }
    if (url === "/json") {
      this.jsonHits++;
      if (this.failJson && this.jsonHits === 1) {
        // First hit 503 like the real endpoint does under rapid polling.
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("busy");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          ...this.tabs,
          { id: "devtools-page", type: "other", title: "DevTools", url: "devtools://devtools/bundled/inspector.html" },
        ])
      );
      return;
    }
    res.writeHead(404);
    res.end();
  }

  handleUpgrade(req, socket) {
    const key = req.headers["sec-websocket-key"];
    const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    let buf = Buffer.alloc(0);
    const send = (obj) => socket.write(encodeFrame(JSON.stringify(obj)));

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { frames, rest } = decodeFrames(buf);
      buf = rest;
      for (const f of frames) {
        if (f.opcode === 8) {
          socket.end();
          return;
        }
        if (f.opcode !== 1) continue;
        let msg;
        try {
          msg = JSON.parse(f.payload.toString("utf8"));
        } catch {
          continue;
        }
        const reply = this.handleCdp(msg, send);
        if (reply !== undefined) send(reply);
      }
    });
    socket.on("error", () => {});
  }

  handleCdp(msg, send) {
    const { id, method, params = {}, sessionId } = msg;
    this.log.push({ method, sessionId: sessionId || null, params });

    switch (method) {
      case "Target.attachToTarget": {
        const sid = `session-${params.targetId}`;
        this.sessions.set(sid, params.targetId);
        return { id, result: { sessionId: sid } };
      }
      case "Target.detachFromTarget":
        return undefined;
      case "Page.bringToFront":
        return { id, result: {} };
      case "Input.insertText": {
        const tabId = this.sessions.get(sessionId);
        const st = this.state.get(tabId);
        if (st) st.buffer += params.text;
        return { id, result: {} };
      }
      case "Input.dispatchKeyEvent": {
        if (params.type === "keyUp" || !params.text) return { id, result: {} };
        const tabId = this.sessions.get(sessionId);
        const st = this.state.get(tabId);
        if (st && st.buffer) {
          const full = `\nREPLY: ${st.replyPrefix || ""}${st.buffer}\n`;
          st.base = st.base !== undefined ? st.base : st.text;
          st.current = "";
          // "Stream" the reply in a few growing chunks, then hold the final
          // text so the client's stability detector can fire.
          st.pending = [];
          for (let i = 1; i < this.streamSteps; i++) {
            st.pending.push(full.slice(0, Math.ceil((full.length * i) / this.streamSteps)));
          }
          st.pending.push(full);
          st.buffer = "";
        }
        return { id, result: {} };
      }
      case "Runtime.evaluate": {
        const tabId = this.sessions.get(sessionId);
        const st = this.state.get(tabId) || { text: "", pending: [] };
        return { id, result: { result: { type: "string", value: this.evalExpression(params.expression || "", st) } } };
      }
      default:
        return { id, error: { code: -32601, message: `mock: unknown method ${method}` } };
    }
  }

  evalExpression(expr, st) {
    if (expr === "document.documentElement.innerText") {
      if (st.pending && st.pending.length > 1) {
        st.current = st.pending.shift();
      } else if (st.pending && st.pending.length === 1) {
        st.current = st.pending[0]; // hold the final text — stable from here on
      }
      const base = st.base !== undefined ? st.base : st.text;
      return base + (st.current || "");
    }
    const jsonStart = expr.lastIndexOf("(");
    if (jsonStart >= 0) {
      let arg = null;
      try {
        arg = JSON.parse(expr.slice(jsonStart + 1).replace(/\)$/, ""));
      } catch {
        arg = null;
      }
      if (arg && Array.isArray(arg.labels)) {
        return { ok: true, matches: 1, index: 0, text: arg.labels[0] };
      }
      if (arg && Array.isArray(arg.selectors)) {
        return { ok: true, selector: arg.selectors[0], tag: "TEXTAREA", count: 1 };
      }
    }
    if (expr.includes("停止") || expr.includes("Stop generating")) return false;
    return "";
  }

  close() {
    return new Promise((resolve) => {
      if (typeof this.http.closeAllConnections === "function") this.http.closeAllConnections();
      this.http.close(() => resolve());
    });
  }
}

module.exports = { MockCdp, DEFAULT_TABS, encodeFrame, decodeFrames };
