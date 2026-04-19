import os
import json
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from database import get_db, DataFile, User
from sqlalchemy.orm import Session
from auth_utils import get_current_user
from routers.admin import log_usage

logger = logging.getLogger(__name__)

# Claude Haiku 4.5 list pricing (USD per million tokens):
#   input  $1.00 → 100 cents / 1,000,000 tokens
#   output $5.00 → 500 cents / 1,000,000 tokens
# Using integer math on cents × tokens keeps everything precise.
HAIKU_INPUT_CENTS_PER_MTOK = 100
HAIKU_OUTPUT_CENTS_PER_MTOK = 500


def _estimate_cost_cents(input_tokens: int, output_tokens: int) -> int:
    total_microcents = (
        input_tokens * HAIKU_INPUT_CENTS_PER_MTOK
        + output_tokens * HAIKU_OUTPUT_CENTS_PER_MTOK
    )
    # Round up so we never under-bill (1,000,000 tokens ≈ 1 cent floor).
    return (total_microcents + 999_999) // 1_000_000

router = APIRouter(prefix="/ai", tags=["ai"])


def _get_owned_file(file_id: str, user: User, db: Session) -> DataFile:
    """Return a DataFile that belongs to the caller's org, or raise 404.
    404 (not 403) so we don't leak existence of other orgs' file IDs."""
    f = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == user.organisation_id,
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return f


def require_ai_enabled(current_user: User = Depends(get_current_user)) -> User:
    """Gate that refuses the call when the caller's org hasn't enabled the
    AI add-on. Returns a 403 with a machine-readable ``code`` so the frontend
    can render the upgrade CTA rather than a generic error toast.
    """
    org = current_user.organisation
    if not org or not bool(getattr(org, "ai_enabled", False)):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ai_disabled",
                "message": "AI features are not enabled for this workspace. An owner or admin can enable them in Organisation settings.",
            },
        )
    return current_user

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
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


@router.post("/stream")
async def stream_ai(
    req: StreamRequest,
    current_user: User = Depends(require_ai_enabled),
    db: Session = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    file = _get_owned_file(req.file_id, current_user, db)
    user_message = build_context(file, req.question)

    # Closure-local counters. Anthropic's SSE sends input_tokens in
    # `message_start` and the final output_tokens in `message_delta`
    # right before `message_stop`. We accumulate then log once the
    # stream completes (success or error).
    usage_state = {"input": 0, "output": 0}
    org_id = current_user.organisation_id
    user_id = current_user.id

    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=120) as client:
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
                            if event_type == "message_start":
                                u = parsed.get("message", {}).get("usage", {}) or {}
                                usage_state["input"] = int(u.get("input_tokens", 0) or 0)
                            elif event_type == "message_delta":
                                u = parsed.get("usage", {}) or {}
                                if u.get("output_tokens") is not None:
                                    usage_state["output"] = int(u.get("output_tokens", 0) or 0)
                            elif event_type == "content_block_delta":
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
        finally:
            # Best-effort usage log; errors here must never break the
            # SSE response that already went to the client.
            try:
                in_tok = usage_state["input"]
                out_tok = usage_state["output"]
                total = in_tok + out_tok
                if total > 0 and org_id:
                    log_usage(
                        db,
                        organisation_id=org_id,
                        user_id=user_id,
                        kind="ai_tokens",
                        quantity=total,
                        cost_cents=_estimate_cost_cents(in_tok, out_tok),
                        meta={
                            "model": MODEL,
                            "endpoint": "/ai/stream",
                            "input_tokens": in_tok,
                            "output_tokens": out_tok,
                            "file_id": req.file_id,
                        },
                    )
            except Exception as exc:
                logger.warning("usage logging failed in /ai/stream: %s", exc)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/greet")
async def greet_file(
    req: GreetRequest,
    current_user: User = Depends(require_ai_enabled),
    db: Session = Depends(get_db),
):
    file = _get_owned_file(req.file_id, current_user, db)

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
    current_user: User = Depends(require_ai_enabled),
    db: Session = Depends(get_db),
):
    """Non-streaming fallback endpoint."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    file = _get_owned_file(req.file_id, current_user, db)
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

    # Usage logging: the non-streaming response includes `usage` at the top
    # level. Mirror the /stream accounting so both endpoints feed the same
    # ledger. Failures here must never surface to the caller.
    try:
        usage = result.get("usage", {}) or {}
        in_tok = int(usage.get("input_tokens", 0) or 0)
        out_tok = int(usage.get("output_tokens", 0) or 0)
        total = in_tok + out_tok
        if total > 0 and current_user.organisation_id:
            log_usage(
                db,
                organisation_id=current_user.organisation_id,
                user_id=current_user.id,
                kind="ai_tokens",
                quantity=total,
                cost_cents=_estimate_cost_cents(in_tok, out_tok),
                meta={
                    "model": MODEL,
                    "endpoint": "/ai/prompt",
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                    "file_id": req.file_id,
                },
            )
    except Exception as exc:
        logger.warning("usage logging failed in /ai/prompt: %s", exc)

    return {"response": text}
