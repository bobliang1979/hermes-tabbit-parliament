"""
Fable-5 Agent — FastAPI Server
提供 SSE/WebSocket 接口给前端调用 Agent。
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, AsyncGenerator

from fable5_agent import Fable5Agent, Fable5Parser

logger = logging.getLogger("fable5_server")


class Fable5Server:
    """Fable-5 Agent HTTP + WebSocket 服务器。"""

    def __init__(
        self,
        llm_endpoint: str = "http://localhost:8000/v1/chat/completions",
        sandbox_endpoint: str = "http://localhost:9001/run",
    ):
        self.agent = Fable5Agent(
            llm_endpoint=llm_endpoint,
            sandbox_endpoint=sandbox_endpoint,
        )
        self._sessions: dict[str, dict] = {}

    async def chat(self, message: str, session_id: str = "") -> dict[str, Any]:
        """单次聊天（非流式）。"""
        if not session_id:
            session_id = uuid.uuid4().hex[:12]
        
        result = await self.agent.run(message)
        self._sessions[session_id] = {
            "history": result.get("thinking", []),
            "tools": result.get("tool_calls", []),
        }
        
        return {
            "session_id": session_id,
            "response": result.get("answer", ""),
            "thinking": result.get("thinking", []),
            "tool_calls": [
                {"name": t["tool"], "params": t["params"]}
                for t in result.get("tool_calls", [])
            ],
            "steps": result.get("steps", 0),
        }

    async def chat_stream(self, message: str, session_id: str = ""):
        """流式聊天，逐步返回 thinking 和 tool_call。"""
        if not session_id:
            session_id = uuid.uuid4().hex[:12]
        
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
        
        result = await self.agent.run(message)
        
        for thought in result.get("thinking", []):
            yield f"data: {json.dumps({'type': 'think', 'content': thought})}\n\n"
            await asyncio.sleep(0.05)
        
        for tc in result.get("tool_calls", []):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': tc['tool'], 'params': tc['params']})}\n\n"
        
        yield f"data: {json.dumps({'type': 'result', 'content': result.get('answer', '')})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'steps': result.get('steps', 0)})}\n\n"


# FastAPI 入口
try:
    from fastapi import FastAPI, Request
    from fastapi.responses import StreamingResponse
    from pydantic import BaseModel
    
    app = FastAPI(title="Fable-5 Agent API")
    server = Fable5Server()

    class ChatRequest(BaseModel):
        message: str
        session_id: str = ""

    @app.post("/chat")
    async def chat_endpoint(req: ChatRequest):
        return await server.chat(req.message, req.session_id)

    @app.post("/chat/stream")
    async def chat_stream_endpoint(req: ChatRequest):
        return StreamingResponse(
            server.chat_stream(req.message, req.session_id),
            media_type="text/event-stream",
        )

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "model": "lordx64/Qwable-v1",
            "engine": "Fable-5 Agent",
        }

except ImportError:
    print("FastAPI not installed. Run: pip install fastapi uvicorn")
    app = None


if __name__ == "__main__":
    import uvicorn
    print("Starting Fable-5 Agent Server on http://localhost:8080")
    print("API docs at http://localhost:8080/docs")
    uvicorn.run(app, host="0.0.0.0", port=8080)
