"""
AI Prompt Router — streaming edition
POST /api/ai/prompt  — plain-text response (legacy)
POST /api/ai/stream  — SSE streaming response
POST /api/ai/greet   — one-shot greeting for a newly uploaded file
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json
import httpx

from database import get_db
from models import File
from auth import get_current_user
from routers.analytics import load_file_data

router = APIRouter(prefix="/ai", tags=["ai"])

OPENAI_URL = "https://api.openai.com/v1/chat/completions"

import os
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


# ── Request / response models ──────────────────────────────────────────────

class PromptRequest(BaseModel):
    file_id: str
    question: str

class StreamRequest(BaseModel):
    file_id: str
    question: str

class GreetRequest(BaseModel):
    file_id: str

class PromptResponse(BaseModel):
    response: str
    file_id: str


# ── System prompt builder ─────────────────────────────────────────────────

def _build_system_prompt(df_info: dict, structured: bool = False) -> str:
    columns = df_info.get("columns", [])
    sample = df_info.get("sample_rows", [])
    stats = df_info.get("column_stats", {})

    col_lines = []
    for col in columns:
        s = stats.get(col, {})
        parts = [f"  - {col}"]
        if s.get("dtype"):
            parts.append(f"type={s['dtype']}")
        if s.get("non_null") is not None:
            parts.append(f"non_null={s['non_null']}")
        if s.get("unique") is not None:
            parts.append(f"unique={s['unique']}")
        if s.get("mean") is not None:
            parts.append(f"mean={round(s['mean'],2)}")
        if s.get("min") is not None:
            parts.append(f"min={s['min']}, max={s['max']}")
        col_lines.append(" | ".join(parts))

    sample_text = ""
    if sample:
        sample_text = "\nSample rows (first 5):\n"
        for row in sample[:5]:
            sample_text += "  " + str(row) + "\n"

    base = f"""You are a data analyst AI. The user has uploaded a dataset with these columns:

{chr(10).join(col_lines)}
{sample_text}
Answer questions clearly and concisely. Use plain text for explanations."""

    if structured:
        base += """

IMPORTANT — Response format rules:
- For tabular answers: respond with ONLY valid JSON in this exact format:
  {"type":"table","summary":"<1-2 sentence description>","columns":["col1","col2"],"rows":[{"col1":"val","col2":"val"},...]}
- For chart/visualization answers: respond with ONLY valid JSON:
  {"type":"chart","summary":"<description>","chart_type":"bar|line|pie","chart_data":[{"label":"X","value":Y}...],"x_key":"label","y_keys":["value"],"title":"Chart Title"}
- For plain questions: respond with plain text only (no JSON).
- Never mix JSON and plain text. Pick one format per response."""

    return base


# ── Helper: get file dataframe info ──────────────────────────────────────

async def _get_file_info(file_id: str, current_user, db: Session) -> dict:
    try:
        fid = int(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id")

    file_rec = db.query(File).filter(
        File.id == fid, File.user_id == current_user.id
    ).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df_info = await load_file_data(file_rec)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load file: {e}")

    return file_rec, df_info


# ── POST /ai/prompt (legacy, non-streaming) ───────────────────────────────

@router.post("/prompt", response_model=PromptResponse)
async def ai_prompt(
    req: PromptRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    file_rec, df_info = await _get_file_info(req.file_id, current_user, db)
    system_prompt = _build_system_prompt(df_info, structured=True)

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {OPENAI_KEY}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.question}
                ],
                "max_tokens": 900,
                "temperature": 0.4
            }
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="OpenAI error")

    answer = resp.json()["choices"][0]["message"]["content"]
    return PromptResponse(response=answer, file_id=req.file_id)


# ── POST /ai/stream (SSE streaming) ──────────────────────────────────────

@router.post("/stream")
async def ai_stream(
    req: StreamRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    file_rec, df_info = await _get_file_info(req.file_id, current_user, db)
    system_prompt = _build_system_prompt(df_info, structured=True)

    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    OPENAI_URL,
                    headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": req.question}
                        ],
                        "max_tokens": 900,
                        "temperature": 0.4,
                        "stream": True
                    }
                ) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield f"data: {delta}\n\n"
                        except Exception:
                            continue
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


# ── POST /ai/greet ────────────────────────────────────────────────────────

@router.post("/greet", response_model=PromptResponse)
async def ai_greet(
    req: GreetRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    file_rec, df_info = await _get_file_info(req.file_id, current_user, db)
    columns = df_info.get("columns", [])
    row_count = df_info.get("row_count", 0)
    filename = getattr(file_rec, "filename", getattr(file_rec, "name", "your file"))

    greeting = (
        f"I've loaded **{filename}** — "
        f"{row_count:,} rows, {len(columns)} columns "
        f"({', '.join(columns[:5])}{'…' if len(columns) > 5 else ''}). "
        f"Ask me anything about it!"
    )

    return PromptResponse(response=greeting, file_id=req.file_id)
