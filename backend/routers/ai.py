"""
AI Prompt Router
POST /api/ai/prompt — accepts a plain-English question about an uploaded file,
fetches the column-level statistical summary via the shared load_file_data
helper, builds a structured context payload, and calls the OpenAI Chat
Completions API to generate an answer.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from auth_utils import get_current_user
from database import get_db, User
from config import settings
from routers.analytics import load_file_data

router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────────

class PromptRequest(BaseModel):
    prompt: str
    file_id: str


class PromptResponse(BaseModel):
    response: str
    file_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_summary(rows: list, filename: str) -> dict:
    """Compute column statistics identical to /analytics/summary."""
    if not rows:
        return {"filename": filename, "rows": 0, "columns": 0, "summary": {}}

    headers = list(rows[0].keys())
    summary = {}

    for h in headers:
        vals = [r[h] for r in rows if r[h] is not None and r[h] != ""]
        try:
            nums = [float(v) for v in vals]
            summary[h] = {
                "type": "numeric",
                "count": len(nums),
                "sum": round(sum(nums), 2),
                "mean": round(sum(nums) / len(nums), 2) if nums else 0,
                "min": round(min(nums), 2) if nums else 0,
                "max": round(max(nums), 2) if nums else 0,
            }
        except (ValueError, TypeError):
            unique = list(set(str(v) for v in vals))
            summary[h] = {
                "type": "text",
                "count": len(vals),
                "unique": len(unique),
                "top_values": unique[:10],
            }

    return {"filename": filename, "rows": len(rows), "columns": len(headers), "summary": summary}


def _build_system_prompt(summary_data: dict) -> str:
    """Convert the summary dict into a compact system prompt for the LLM."""
    filename = summary_data.get("filename", "the dataset")
    rows = summary_data.get("rows", 0)
    columns = summary_data.get("columns", 0)
    summary = summary_data.get("summary", {})

    col_lines = []
    for col_name, stats in summary.items():
        col_type = stats.get("type", "unknown")
        count = stats.get("count", 0)
        if col_type == "numeric":
            line = (
                f"  - {col_name} [numeric]: count={count}, "
                f"sum={stats.get('sum')}, mean={stats.get('mean')}, "
                f"min={stats.get('min')}, max={stats.get('max')}"
            )
        else:
            top = ", ".join(stats.get("top_values", [])[:5])
            line = (
                f"  - {col_name} [text]: count={count}, "
                f"unique={stats.get('unique')}, top values: {top}"
            )
        col_lines.append(line)

    col_text = "\n".join(col_lines) if col_lines else "  (no columns)"

    return f"""You are a data analyst assistant for DataHub Pro, an analytics SaaS platform.
The user has uploaded a dataset and wants insights in plain English.

Dataset: {filename}
Rows: {rows}
Columns: {columns}

Column statistics:
{col_text}

Instructions:
- Answer the user's question using only the statistics provided above.
- Be concise but informative. Use plain language suitable for a business user.
- Format your answer with short paragraphs or bullet points where helpful.
- If the question cannot be answered from the statistics alone, say so briefly.
- Never invent numbers that are not present in the statistics above.
"""


async def _call_openai(system_prompt: str, user_prompt: str) -> str:
    """Call OpenAI Chat Completions API and return the assistant text."""
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return (
            "AI responses are not yet configured for this instance. "
            "An administrator needs to set the OPENAI_API_KEY environment variable to enable this feature."
        )

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "max_tokens": 700,
        "temperature": 0.4,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code == 401:
        raise HTTPException(status_code=500, detail="OpenAI API key is invalid — please check your configuration")
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="OpenAI rate limit reached — please try again in a moment")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenAI returned an error ({resp.status_code})")

    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/prompt",
    response_model=PromptResponse,
    summary="Ask a plain-English question about an uploaded file",
)
async def ai_prompt(
    body: PromptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepts { prompt, file_id }.
    Loads the file's data, computes column-level statistics, and calls OpenAI
    to generate a plain-English answer. Works without an API key — returns a
    friendly message instead of crashing.
    """
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt must not be empty")
    if not body.file_id.strip():
        raise HTTPException(status_code=400, detail="file_id must not be empty")

    # Load file rows (raises 404 if file not found or not owned by this org)
    rows, filename = load_file_data(body.file_id, current_user.organisation_id, db)

    summary_data = _build_summary(rows, filename)
    system_prompt = _build_system_prompt(summary_data)
    answer = await _call_openai(system_prompt, body.prompt)

    return PromptResponse(response=answer, file_id=body.file_id)
