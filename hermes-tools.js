// Hermes Tools — 控制 Tabbit 5 个模型的轻量工具集
// Hermes 用这些函数作为"手"，思考由 Hermes 自己完成。
// Usage: node hermes-tools.js <command> [args]
//
// Commands:
//   list                          — 列出所有标签
//   ask <keyword> <prompt>        — 向模型提问并读取回复
//   read <keyword>                — 读取页面内容
//   new <keyword>                 — 新建对话

const CDP_HTTP = "http://localhost:9222";
const http = require("http");
const fs = require("fs");

function getJSON(path) {
    return new Promise((ok, fail) => {
        http.get(`${CDP_HTTP}${path}`, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { fail(e); } }); }).on("error", fail);
    });
}

async function listPages() {
    const all = await getJSON("/json");
    return all.filter(t => t.type === "page");
}

function findPage(pages, kw) {
    const q = kw.toLowerCase();
    return pages.find(t => (t.title || "").toLowerCase().includes(q) || (t.url || "").toLowerCase().includes(q));
}

// ─── 新建对话 ───

async function newChat(targetId) {
    const ver = await getJSON("/json/version");
    return new Promise(resolve => {
        const ws = new WebSocket(ver.webSocketDebuggerUrl);
        let sid, cid = 1;
        ws.addEventListener("open", () => { ws.send(JSON.stringify({ id: cid++, method: "Target.attachToTarget", params: { targetId, flatten: true } })); });
        ws.addEventListener("message", ev => {
            const m = JSON.parse(ev.data);
            if (m.id === 1 && m.result) {
                sid = m.result.sessionId;
                ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Runtime.evaluate",
                    params: { expression: `(()=>{const p=["新建聊天","新对话","新建","New chat","New Chat","New conversation"];const a=document.querySelectorAll('button,a,div[role="button"],span');for(const e of a){const t=(e.textContent||"").trim();if(p.some(x=>t.includes(x))&&t.length<25){e.click();return t}}return"nf"})()`, returnByValue: true, awaitPromise: false } }));
            } else if (m.id >= 2) { ws.close(); resolve(m.result?.result?.value || ""); }
        });
        setTimeout(() => { try { ws.close(); } catch {} resolve(""); }, 8000);
    });
}

// ─── 发送提示并读取回复（Hermes 的核心工具）───

async function sendAndRead(targetId, prompt, waitSec = 25) {
    // 1. 新建对话
    await newChat(targetId);
    await new Promise(r => setTimeout(r, 2000));

    // 2. 发送
    const ver = await getJSON("/json/version");
    await new Promise(resolve => {
        const ws = new WebSocket(ver.webSocketDebuggerUrl);
        let sid, cid = 1, typed = false;
        ws.addEventListener("open", () => { ws.send(JSON.stringify({ id: cid++, method: "Target.attachToTarget", params: { targetId, flatten: true } })); });
        ws.addEventListener("message", async ev => {
            const m = JSON.parse(ev.data);
            if (m.id === 1 && m.result) {
                sid = m.result.sessionId;
                ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Page.bringToFront" }));
                ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Runtime.evaluate",
                    params: { expression: `(()=>{const e=document.querySelector('[contenteditable="true"][role="textbox"]')||document.querySelector("textarea");if(e){e.focus();return"OK"}return"no"})()`, returnByValue: true, awaitPromise: false } }));
            } else if (m.id === 3) {
                // Type in chunks
                const typeAll = async () => {
                    for (let i = 0; i < prompt.length; i += 3000) {
                        ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Input.insertText", params: { text: prompt.slice(i, i + 3000) } }));
                        await new Promise(r => setTimeout(r, 50));
                    }
                    // Enter key
                    setTimeout(() => {
                        ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Input.dispatchKeyEvent", params: { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" } }));
                        setTimeout(() => {
                            ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Input.dispatchKeyEvent", params: { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 } }));
                            resolve(true); ws.close();
                        }, 300);
                    }, 500);
                };
                typeAll();
            }
        });
        setTimeout(() => { try { ws.close(); } catch {} resolve(false); }, 15000);
    });

    // 3. 等待并读取
    await new Promise(r => setTimeout(r, waitSec * 1000));
    const text = await new Promise(resolve => {
        const ws = new WebSocket(ver.webSocketDebuggerUrl);
        let sid, cid = 1;
        ws.addEventListener("open", () => { ws.send(JSON.stringify({ id: cid++, method: "Target.attachToTarget", params: { targetId, flatten: true } })); });
        ws.addEventListener("message", ev => {
            const m = JSON.parse(ev.data);
            if (m.id === 1 && m.result) {
                sid = m.result.sessionId;
                ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Runtime.evaluate",
                    params: { expression: "document.documentElement.innerText", returnByValue: true, awaitPromise: false } }));
            } else if (m.id === 2) { ws.close(); resolve(m.result?.result?.value || ""); }
        });
        setTimeout(() => { try { ws.close(); } catch {} resolve(""); }, 20000);
    });
    return text || "";
}

// ─── 命令入口 ───

async function main() {
    const cmd = process.argv[2];
    const args = process.argv.slice(3);

    if (cmd === "list" || cmd === "ls") {
        const pages = await listPages();
        const roles = { gemini: "🧠 议长 Gemini", qianwen: "💬 工程师 千问", grok: "🔍 研究员 Grok", chatglm: "✍️ 书记员 清言", "arena.ai": "🤝 评审官 Arena" };
        console.log(`\n  Tabbit — ${pages.length} 个模型标签\n`);
        for (const t of pages) {
            let label = "📄";
            for (const [k, v] of Object.entries(roles)) { if ((t.url || "").includes(k) || (t.title || "").toLowerCase().includes(k)) { label = v; break; } }
            console.log(`  ${label}`);
            console.log(`     ${t.title || "(无标题)"}`);
            const tid = t.id.slice(0, 12);
            console.log(`     sendAndRead("${tid}", "你的提示")\n`);
        }
    } else if (cmd === "ask" && args.length >= 2) {
        const kw = args[0];
        const prompt = args.slice(1).join(" ");
        const pages = await listPages();
        const target = findPage(pages, kw);
        if (!target) { console.log(`❌ 未找到 "${kw}"`); return; }
        console.log(`\n  📤 发送至: ${target.title}`);
        console.log(`  📝 ${prompt.slice(0, 60)}...\n`);
        const text = await sendAndRead(target.id, prompt, 25);
        if (text) {
            console.log(`\n  📄 回复 (${text.length} chars):`);
            console.log(`  ${"━".repeat(50)}`);
            console.log(text.slice(-1500));
            console.log(`  ${"━".repeat(50)}`);
            const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            fs.writeFileSync(`hermes_ask_${kw}_${ts}.md`, text);
            console.log(`  💾 已保存`);
        } else {
            console.log("  ❌ 无回复");
        }
    } else if (cmd === "read" && args.length >= 1) {
        const kw = args[0];
        const pages = await listPages();
        const target = findPage(pages, kw);
        if (!target) { console.log(`❌ 未找到`); return; }
        const ver = await getJSON("/json/version");
        const text = await new Promise(resolve => {
            const ws = new WebSocket(ver.webSocketDebuggerUrl);
            let sid, cid = 1;
            ws.addEventListener("open", () => { ws.send(JSON.stringify({ id: cid++, method: "Target.attachToTarget", params: { targetId: target.id, flatten: true } })); });
            ws.addEventListener("message", ev => {
                const m = JSON.parse(ev.data);
                if (m.id === 1 && m.result) {
                    sid = m.result.sessionId;
                    ws.send(JSON.stringify({ id: cid++, sessionId: sid, method: "Runtime.evaluate",
                        params: { expression: "document.documentElement.innerText", returnByValue: true, awaitPromise: false } }));
                } else if (m.id === 2) { ws.close(); resolve(m.result?.result?.value || ""); }
            });
            setTimeout(() => { try { ws.close(); } catch {} resolve(""); }, 15000);
        });
        console.log(`\n  📄 ${target.title} — ${(text || "").length} chars`);
        console.log(`${"━".repeat(50)}`);
        console.log((text || "").slice(-1000));
    } else if (cmd === "new" && args.length >= 1) {
        const kw = args[0];
        const pages = await listPages();
        const target = findPage(pages, kw);
        if (!target) { console.log(`❌ 未找到`); return; }
        const r = await newChat(target.id);
        console.log(`  🆕 ${target.title}: ${r || "done"}`);
    } else {
        console.log(`\n🧠 Hermes Tools — 控制 Tabbit 5 模型\n`);
        console.log(`用法:`);
        console.log(`  node hermes-tools.js list              — 列出模型`);
        console.log(`  node hermes-tools.js ask <词> <提示>    — 发送并读取回复`);
        console.log(`  node hermes-tools.js read <词>          — 读取当前内容`);
        console.log(`  node hermes-tools.js new <词>           — 新建对话\n`);
        console.log(`Hermes 的工作流:`);
        console.log(`  1. list → 查看可用模型`);
        console.log(`  2. ask Gemini "设计一个缓存系统的架构"`);
        console.log(`  3. Hermes分析回复 → 决定下一步`);
        console.log(`  4. ask 千问 "根据架构实现代码"`);
        console.log(`  5. Hermes检查代码 → 决定是否需要审查`);
        console.log(`  6. ask Arena "审查这段代码"`);
        console.log(`  7. 迭代直到完成\n`);
    }
}

main().catch(console.error);
