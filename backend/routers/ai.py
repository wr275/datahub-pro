import os

from config import settings
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from database import get_db, DataFile, User
from sqlalchemy.orm import Session
from auth_utils import get_current_user

router = APIRouter(tags=["ai"])

ANTHROPIC_API_KEY = settings.ANTHROPIC_API_KEY or ""
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a data analyst assistant embedded in a data hub application.
The user will ask questions about their uploaded data files (CSVs, spreadsheets, etc.).

When asked to show data as a table, output ONLY this raw JSON with no markdown, no code blocks, no backticks:
{"type":"table","summary":"brief description","columns":["col1","col2"],"rows":[{"col1":"val1","col2":"val2"}]}

When asked to show a chart or graph, output ONLY this raw JSON with no markdown, no code blocks, no backticks:
{"type":"chart","summary":"brief description","chart_type":"bar","chart_data":[{"name":"A","value":10}],"x_key":"name","y_keys":["value"],"title":"Chart Title"}

chart_type must be one of: bar, line, pie
CRITICAL: For table and chart responses, output ONLY the raw JSON object starting with { and ending with }. Never use markdown code blocks or backticks. Never add any text before or after the JSON.

For all other questions, respond with clear, concise plain text.
Be helpful, accurate, and data-focused. Keep responses brief unless detail is requested."""


class StreamRequest(BaseModel):
    file_id: str
    question: str


class GreetRequest(BaseModel):
    file_id: str
    filename: Optional[str] = None
    rows: Optional[int] = None
    cols: Optional[int] = None


class PromptRequest(BaseModel):
    file_id: str
    question: str


def build_context(file: DataFile, question: str) -> str:
    parts = [f"File: {file.filename}"]
    if file.row_count:
        parts.append(f"Rows: {file.row_count}")
    if file.column_count:
        parts.append(f"Columns: {file.column_count}")
    if file.columns_json:
        try:
            cols = json.loads(file.columns_json) if isinstance(file.columns_json, str) else file.columns_json
            parts.append(f"Column names: {', '.join(str(c) for c in cols[:20])}")
        except Exception:
            pass
    if file.file_content:
        try:
            raw = file.file_content
            preview = raw.decode("utf-8", errors="replace")[:3000] if isinstance(raw, bytes) else str(raw)[:3000]
            parts.append(f"\nData preview:\n{preview}")
        except Exception:
            pass
    parts.append(f"\nUser question: {question}")
    return "\n".join(parts)


def _get_org_file(file_id: str, current_user: User, db: Session) -> DataFile:
    """Fetch a file that belongs to the current user's organisation."""
    file = (
        db.query(DataFile)
        .filter(
            DataFile.id == file_id,
            DataFile.organisation_id == current_user.organisation_id,
        )
        .first()
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.post("/stream")
async def stream_ai(
    req: StreamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    file = _get_org_file(req.file_id, current_user, db)
    user_message = build_context(file, req.question)

    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    ANTHROPIC_URL,
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": MODEL,
                        "max_tokens": 2048,
                        "stream": True,
                        "system": SYSTEM_PROMPT,
                        "messages": [{"role": "user", "content": user_message}],
                    },
                ) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        try:
                            parsed = json.loads(data)
                            event_type = parsed.get("type", "")
                            if event_type == "content_block_delta":
                                delta = parsed.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    text = delta.get("text", "")
                                    if text:
                                        yield f"data: {text}\n\n"
                            elif event_type == "message_stop":
                                yield "data: [DONE]\n\n"
                                break
                            elif event_type == "error":
                                error_msg = parsed.get("error", {}).get("message", "Unknown error")
                                yield f"data: Error: {error_msg}\n\n"
                                yield "data: [DONE]\n\n"
                                break
                        except Exception:
                            pass
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/greet")
async def greet_file(
    req: GreetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = _get_org_file(req.file_id, current_user, db)

    name = req.filename or file.filename or "your file"
    rows = req.rows or file.row_count or 0
    cols = req.cols or file.column_count or 0

    greeting = f"I've loaded **{name}**"
    if rows and cols:
        greeting += f" — {rows:,} rows, {cols} columns."
    elif rows:
        greeting += f" — {rows:,} rows."
    else:
        greeting += "."
    greeting += " Ask me anything about it!"

    return {"greeting": greeting}


@router.post("/prompt")
async def prompt_ai(
    req: PromptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Non-streaming fallback endpoint."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    file = _get_org_file(req.file_id, current_user, db)
    user_message = build_context(file, req.question)

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 2048,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_message}],
            },
        )
        result = response.json()
        content = result.get("content", [{}])
        text = content[0].get("text", "") if content else ""

    return {"response": text}
