"""Platform-level admin endpoints — the /api/admin/* surface.

Every endpoint in this file is gated by `require_superuser`, which
returns 404 (not 403) so the existence of this namespace isn't
discoverable by regular users.

Lives alongside the org-scoped routers but intentionally knows nothing
about `role`. The only access control is the super-admin bit on User.

Sections (map 1:1 to the frontend tabs):
  - Overview       → GET  /overview
  - Organisations  → GET  /organisations, GET/PATCH /organisations/{id}
  - Users          → GET  /users,         PATCH /users/{id}
  - AI requests    → GET  /ai-requests,   POST  /ai-requests/{id}/approve|/deny
  - Billing        → GET  /billing
  - Usage          → GET  /usage

The approve/deny endpoints also emit the requester-facing notification
email — that's part of the contract the frontend relies on.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import json
import logging

from database import (
    get_db, User, Organisation, AuditLog, AiAccessRequest, UsageEvent,
    DataFile, SubscriptionTier,
)
from auth_utils import require_superuser
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# Plan → monthly price in pence (GBP). Mirrors billing.PLAN_PRICES but
# kept here as a standalone constant so the admin surface doesn't have
# to import billing internals.
PLAN_PRICE_PENCE = {"starter": 4900, "growth": 14900, "enterprise": 49900}


# ─── Helpers ────────────────────────────────────────────────────────

def _audit(db: Session, *, actor: User, org_id: Optional[str],
           action: str, detail: str) -> None:
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=actor.id,
        organisation_id=org_id,
        action=action,
        detail=detail,
    ))


def _org_summary(org: Organisation, db: Session) -> dict:
    user_count = db.query(func.count(User.id)).filter(User.organisation_id == org.id).scalar() or 0
    file_count = db.query(func.count(DataFile.id)).filter(DataFile.organisation_id == org.id).scalar() or 0
    tier = org.subscription_tier.value if org.subscription_tier else None
    mrr_pence = PLAN_PRICE_PENCE.get(tier, 0) if org.subscription_status == "active" else 0
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": tier,
        "subscription_status": org.subscription_status,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        "ai_enabled": bool(getattr(org, "ai_enabled", False)),
        "ai_enabled_at": org.ai_enabled_at.isoformat() if getattr(org, "ai_enabled_at", None) else None,
        "user_count": int(user_count),
        "file_count": int(file_count),
        "mrr_pence": int(mrr_pence),
        "stripe_customer_id": org.stripe_customer_id,
        "created_at": org.created_at.isoformat() if org.created_at else None,
    }


def _user_summary(user: User) -> dict:
    org = user.organisation
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": bool(user.is_active),
        "is_verified": bool(user.is_verified),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "organisation_id": user.organisation_id,
        "organisation_name": org.name if org else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _ai_request_summary(req: AiAccessRequest, db: Session) -> dict:
    org = db.query(Organisation).filter(Organisation.id == req.organisation_id).first()
    requester = db.query(User).filter(User.id == req.requested_by_user_id).first()
    reviewer = (
        db.query(User).filter(User.id == req.reviewed_by_user_id).first()
        if req.reviewed_by_user_id else None
    )
    return {
        "id": req.id,
        "status": req.status,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
        "review_note": req.review_note,
        "requester_note": req.requester_note,
        "organisation": {
            "id": org.id,
            "name": org.name,
            "plan": org.subscription_tier.value if org and org.subscription_tier else None,
            "ai_enabled": bool(getattr(org, "ai_enabled", False)) if org else False,
        } if org else None,
        "requester": {
            "id": requester.id,
            "email": requester.email,
            "full_name": requester.full_name,
            "role": requester.role,
        } if requester else None,
        "reviewer": {
            "id": reviewer.id,
            "email": reviewer.email,
            "full_name": reviewer.full_name,
        } if reviewer else None,
    }


def _send_ai_decision_email(*, to_email: str, requester_name: str, org_name: str,
                            approved: bool, note: str = "", hub_url: str = "") -> bool:
    """Email the requester with the approve/deny decision.

    Best-effort — returns False silently if SendGrid isn't configured.
    """
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — AI decision email skipped for %s", to_email)
        return False

    action_word = "approved" if approved else "not approved"
    headline = (
        "Your AI access is now live" if approved
        else "Your AI access request wasn't approved"
    )
    body_copy = (
        f"<p>Your request to enable the AI add-on for <strong>{org_name}</strong> has been "
        f"<strong>{action_word}</strong>.</p>"
        + (f"<p>All AI tools — Ask Your Data, AI Insights, Auto Report, AI Narrative and "
           f"Formula Builder AI — are unlocked for everyone in your workspace.</p>"
           if approved else
           "<p>You can request access again from the AI tab on the Hub at any time.</p>")
    )
    if note:
        safe_note = note.replace("<", "&lt;")
        body_copy += (
            f"<p style='color:#6b7280;margin-top:20px;padding:12px 16px;"
            f"background:#f9fafb;border-radius:8px;border-left:3px solid #e91e8c;'>"
            f"<strong>Note from DataHub Pro:</strong> {safe_note}</p>"
        )

    cta_html = (
        f"<div style='text-align:center;margin:28px 0;'>"
        f"<a href='{hub_url}' style='display:inline-block;background:#e91e8c;color:#fff;"
        f"font-weight:700;font-size:0.95rem;padding:13px 32px;border-radius:8px;"
        f"text-decoration:none;'>Open DataHub Pro →</a></div>"
    ) if hub_url and approved else ""

    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1446,#1a2a6c);padding:28px 32px;">
      <div style="color:#fff;font-weight:700;font-size:1rem;opacity:0.9;margin-bottom:12px;">DataHub Pro</div>
      <div style="color:#fff;font-size:1.4rem;font-weight:800;">{headline}</div>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:0.95rem;line-height:1.55;">
      <p>Hi {requester_name or "there"},</p>
      {body_copy}
      {cta_html}
    </div>
  </div>
</body></html>"""

    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=headline,
            html_content=html,
        )
        client = sg_lib.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        resp = client.send(msg)
        return resp.status_code in (200, 201, 202)
    except Exception as exc:
        logger.error("AI decision email failed for %s: %s", to_email, exc)
        return False


# ─── Overview ───────────────────────────────────────────────────────

@router.get("/overview")
def get_overview(
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    """Headline KPIs for the admin home page."""
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    total_orgs = db.query(func.count(Organisation.id)).scalar() or 0
    paying_orgs = (
        db.query(func.count(Organisation.id))
        .filter(Organisation.subscription_status == "active").scalar() or 0
    )
    trialing_orgs = (
        db.query(func.count(Organisation.id))
        .filter(Organisation.subscription_status == "trialing").scalar() or 0
    )
    ai_enabled_orgs = (
        db.query(func.count(Organisation.id))
        .filter(Organisation.ai_enabled == True).scalar() or 0  # noqa: E712
    )

    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users_7d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= seven_days_ago).scalar() or 0
    )
    new_users_30d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= thirty_days_ago).scalar() or 0
    )

    pending_ai_requests = (
        db.query(func.count(AiAccessRequest.id))
        .filter(AiAccessRequest.status == "pending").scalar() or 0
    )

    # MRR: sum of plan price for every active subscription.
    active_orgs = (
        db.query(Organisation)
        .filter(Organisation.subscription_status == "active").all()
    )
    mrr_pence = 0
    plan_distribution = {"starter": 0, "growth": 0, "enterprise": 0}
    for org in active_orgs:
        tier = org.subscription_tier.value if org.subscription_tier else None
        if tier in PLAN_PRICE_PENCE:
            mrr_pence += PLAN_PRICE_PENCE[tier]
        if tier in plan_distribution:
            plan_distribution[tier] += 1

    # Recent signups (last 10)
    recent_users = (
        db.query(User).order_by(desc(User.created_at)).limit(10).all()
    )

    # Daily signups for last 30d (for sparkline on overview)
    daily_signups = []
    for i in range(29, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = (
            db.query(func.count(User.id))
            .filter(User.created_at >= day_start, User.created_at < day_end).scalar() or 0
        )
        daily_signups.append({"date": day_start.date().isoformat(), "count": int(count)})

    return {
        "totals": {
            "organisations": int(total_orgs),
            "paying": int(paying_orgs),
            "trialing": int(trialing_orgs),
            "ai_enabled": int(ai_enabled_orgs),
            "users": int(total_users),
            "new_users_7d": int(new_users_7d),
            "new_users_30d": int(new_users_30d),
            "pending_ai_requests": int(pending_ai_requests),
            "mrr_pence": int(mrr_pence),
        },
        "plan_distribution": plan_distribution,
        "recent_users": [_user_summary(u) for u in recent_users],
        "daily_signups": daily_signups,
    }


# ─── Organisations ──────────────────────────────────────────────────

@router.get("/organisations")
def list_organisations(
    q: Optional[str] = Query(None, description="Search by name/slug"),
    plan: Optional[str] = Query(None),
    ai: Optional[str] = Query(None, description="'on' | 'off'"),
    status_: Optional[str] = Query(None, alias="status"),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    query = db.query(Organisation)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(or_(
            func.lower(Organisation.name).like(like),
            func.lower(Organisation.slug).like(like),
        ))
    if plan in ("starter", "growth", "enterprise"):
        query = query.filter(Organisation.subscription_tier == SubscriptionTier(plan))
    if ai == "on":
        query = query.filter(Organisation.ai_enabled == True)  # noqa: E712
    elif ai == "off":
        query = query.filter(Organisation.ai_enabled == False)  # noqa: E712
    if status_:
        query = query.filter(Organisation.subscription_status == status_)
    orgs = query.order_by(desc(Organisation.created_at)).all()
    return {"organisations": [_org_summary(o, db) for o in orgs]}


@router.get("/organisations/{org_id}")
def get_organisation_detail(
    org_id: str,
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    users = db.query(User).filter(User.organisation_id == org_id).all()
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    tokens_30d = (
        db.query(func.coalesce(func.sum(UsageEvent.quantity), 0))
        .filter(UsageEvent.organisation_id == org_id)
        .filter(UsageEvent.kind == "ai_tokens")
        .filter(UsageEvent.created_at >= thirty_days_ago).scalar() or 0
    )
    cost_30d = (
        db.query(func.coalesce(func.sum(UsageEvent.cost_cents), 0))
        .filter(UsageEvent.organisation_id == org_id)
        .filter(UsageEvent.kind == "ai_tokens")
        .filter(UsageEvent.created_at >= thirty_days_ago).scalar() or 0
    )
    uploads_30d = (
        db.query(func.count(UsageEvent.id))
        .filter(UsageEvent.organisation_id == org_id)
        .filter(UsageEvent.kind == "file_upload")
        .filter(UsageEvent.created_at >= thirty_days_ago).scalar() or 0
    )
    recent_audit = (
        db.query(AuditLog)
        .filter(AuditLog.organisation_id == org_id)
        .order_by(desc(AuditLog.created_at)).limit(20).all()
    )

    summary = _org_summary(org, db)
    summary["users"] = [_user_summary(u) for u in users]
    summary["usage_30d"] = {
        "ai_tokens": int(tokens_30d),
        "ai_cost_cents": int(cost_30d),
        "uploads": int(uploads_30d),
    }
    summary["recent_audit"] = [
        {
            "id": a.id,
            "action": a.action,
            "detail": a.detail,
            "user_id": a.user_id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in recent_audit
    ]
    return summary


class OrgPatchRequest(BaseModel):
    plan: Optional[str] = Field(None, description="starter|growth|enterprise")
    ai_enabled: Optional[bool] = None
    subscription_status: Optional[str] = Field(None, description="active|trialing|cancelled|suspended")


@router.patch("/organisations/{org_id}")
def patch_organisation(
    org_id: str,
    body: OrgPatchRequest,
    admin: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    """Edit an org. Every change lands as an AuditLog row for traceability."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    changes = []
    if body.plan is not None:
        if body.plan not in ("starter", "growth", "enterprise"):
            raise HTTPException(status_code=400, detail="Invalid plan")
        prev = org.subscription_tier.value if org.subscription_tier else None
        org.subscription_tier = SubscriptionTier(body.plan)
        # Keep quotas in sync with the plan pick.
        if body.plan == "starter":
            org.max_users, org.max_uploads_per_month = 3, 10
        elif body.plan == "growth":
            org.max_users, org.max_uploads_per_month = 10, 999
        else:
            org.max_users, org.max_uploads_per_month = 999, 999
        changes.append(f"plan: {prev} → {body.plan}")

    if body.ai_enabled is not None:
        prev = bool(getattr(org, "ai_enabled", False))
        org.ai_enabled = bool(body.ai_enabled)
        if body.ai_enabled and not prev:
            org.ai_enabled_at = datetime.utcnow()
        changes.append(f"ai_enabled: {prev} → {bool(body.ai_enabled)}")

    if body.subscription_status is not None:
        prev = org.subscription_status
        org.subscription_status = body.subscription_status
        changes.append(f"subscription_status: {prev} → {body.subscription_status}")

    if not changes:
        raise HTTPException(status_code=400, detail="No changes specified")

    _audit(db, actor=admin, org_id=org.id,
           action="admin_org_patch", detail="; ".join(changes))
    db.commit()
    db.refresh(org)
    return _org_summary(org, db)


# ─── Users ──────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    q: Optional[str] = Query(None, description="Search email/name"),
    role: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status", description="'active'|'suspended'"),
    org_id: Optional[str] = None,
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(or_(
            func.lower(User.email).like(like),
            func.lower(User.full_name).like(like),
        ))
    if role:
        query = query.filter(User.role == role)
    if status_ == "active":
        query = query.filter(User.is_active == True)  # noqa: E712
    elif status_ == "suspended":
        query = query.filter(User.is_active == False)  # noqa: E712
    if org_id:
        query = query.filter(User.organisation_id == org_id)
    users = query.order_by(desc(User.created_at)).limit(500).all()

    superuser_count = (
        db.query(func.count(User.id))
        .filter(User.is_superuser == True).scalar() or 0  # noqa: E712
    )
    active_count = (
        db.query(func.count(User.id))
        .filter(User.is_active == True).scalar() or 0  # noqa: E712
    )
    return {
        "users": [_user_summary(u) for u in users],
        "totals": {
            "all": int(db.query(func.count(User.id)).scalar() or 0),
            "active": int(active_count),
            "superusers": int(superuser_count),
        },
    }


class UserPatchRequest(BaseModel):
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


@router.patch("/users/{user_id}")
def patch_user(
    user_id: str,
    body: UserPatchRequest,
    admin: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Safety: don't let an admin accidentally demote themselves into a
    # lockout state. If they're the last superuser, block revoke.
    if body.is_superuser is False and target.id == admin.id:
        remaining = (
            db.query(func.count(User.id))
            .filter(User.is_superuser == True, User.id != admin.id).scalar() or 0  # noqa: E712
        )
        if remaining == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot revoke your own superuser — you're the only one left. "
                       "Grant another user first.",
            )

    changes = []
    if body.is_active is not None:
        prev = bool(target.is_active)
        target.is_active = bool(body.is_active)
        changes.append(f"is_active: {prev} → {bool(body.is_active)}")
    if body.is_superuser is not None:
        prev = bool(getattr(target, "is_superuser", False))
        target.is_superuser = bool(body.is_superuser)
        changes.append(f"is_superuser: {prev} → {bool(body.is_superuser)}")

    if not changes:
        raise HTTPException(status_code=400, detail="No changes specified")

    _audit(db, actor=admin, org_id=target.organisation_id,
           action="admin_user_patch", detail=f"target={target.email}; " + "; ".join(changes))
    db.commit()
    db.refresh(target)
    return _user_summary(target)


# ─── AI access requests ─────────────────────────────────────────────

@router.get("/ai-requests")
def list_ai_requests(
    status_: Optional[str] = Query(None, alias="status",
                                   description="pending|approved|denied; default=all"),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    query = db.query(AiAccessRequest)
    if status_ in ("pending", "approved", "denied"):
        query = query.filter(AiAccessRequest.status == status_)
    reqs = query.order_by(desc(AiAccessRequest.created_at)).limit(500).all()

    counts = {"pending": 0, "approved": 0, "denied": 0}
    for row, n in (
        db.query(AiAccessRequest.status, func.count(AiAccessRequest.id))
        .group_by(AiAccessRequest.status).all()
    ):
        if row in counts:
            counts[row] = int(n)

    return {
        "requests": [_ai_request_summary(r, db) for r in reqs],
        "counts": counts,
    }


class AiDecisionRequest(BaseModel):
    note: Optional[str] = Field(None, description="Optional message to the requester")


def _decide_ai_request(db: Session, admin: User, req_id: str,
                       approve: bool, note: Optional[str]) -> dict:
    req = db.query(AiAccessRequest).filter(AiAccessRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400,
                            detail=f"Request is already {req.status}")

    org = db.query(Organisation).filter(Organisation.id == req.organisation_id).first()
    requester = db.query(User).filter(User.id == req.requested_by_user_id).first()
    if not org or not requester:
        raise HTTPException(status_code=404, detail="Org or requester no longer exists")

    req.status = "approved" if approve else "denied"
    req.reviewed_by_user_id = admin.id
    req.reviewed_at = datetime.utcnow()
    req.review_note = (note or "").strip() or None

    if approve:
        was_enabled = bool(getattr(org, "ai_enabled", False))
        org.ai_enabled = True
        if not was_enabled:
            org.ai_enabled_at = datetime.utcnow()

    _audit(db, actor=admin, org_id=org.id,
           action="admin_ai_" + ("approve" if approve else "deny"),
           detail=f"request={req.id}; org={org.name}; requester={requester.email}"
                  + (f"; note={req.review_note}" if req.review_note else ""))

    db.commit()
    db.refresh(req)

    # Best-effort notification — don't fail the request if email flops.
    frontend = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    hub_url = f"{frontend}/hub" if frontend else ""
    _send_ai_decision_email(
        to_email=requester.email,
        requester_name=requester.full_name or requester.email,
        org_name=org.name,
        approved=approve,
        note=req.review_note or "",
        hub_url=hub_url,
    )
    return _ai_request_summary(req, db)


@router.post("/ai-requests/{req_id}/approve")
def approve_ai_request(
    req_id: str,
    body: AiDecisionRequest = AiDecisionRequest(),
    admin: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    return _decide_ai_request(db, admin, req_id, approve=True, note=body.note)


@router.post("/ai-requests/{req_id}/deny")
def deny_ai_request(
    req_id: str,
    body: AiDecisionRequest = AiDecisionRequest(),
    admin: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    return _decide_ai_request(db, admin, req_id, approve=False, note=body.note)


# ─── Billing ────────────────────────────────────────────────────────

@router.get("/billing")
def get_billing_overview(
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    """Revenue snapshot — read-only. Edits happen in Stripe directly."""
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # MRR by plan (only for `active` subscriptions)
    active_orgs = (
        db.query(Organisation)
        .filter(Organisation.subscription_status == "active").all()
    )
    by_plan = {p: {"count": 0, "mrr_pence": 0} for p in PLAN_PRICE_PENCE}
    total_mrr = 0
    for org in active_orgs:
        tier = org.subscription_tier.value if org.subscription_tier else None
        if tier in by_plan:
            by_plan[tier]["count"] += 1
            by_plan[tier]["mrr_pence"] += PLAN_PRICE_PENCE[tier]
            total_mrr += PLAN_PRICE_PENCE[tier]

    trialing = (
        db.query(func.count(Organisation.id))
        .filter(Organisation.subscription_status == "trialing").scalar() or 0
    )
    cancelled = (
        db.query(func.count(Organisation.id))
        .filter(Organisation.subscription_status == "cancelled").scalar() or 0
    )
    # Crude churn figure: cancellations in the last 30d / active_at_start.
    # Refine once we have a SubscriptionEvent log.
    cancelled_30d = (
        db.query(func.count(AuditLog.id))
        .filter(AuditLog.action == "subscription_cancelled")
        .filter(AuditLog.created_at >= thirty_days_ago).scalar() or 0
    )
    active_count = len(active_orgs)
    churn_rate = (
        (cancelled_30d / active_count) if active_count > 0 else 0.0
    )

    return {
        "total_mrr_pence": int(total_mrr),
        "annualised_revenue_pence": int(total_mrr * 12),
        "by_plan": by_plan,
        "active_count": int(active_count),
        "trialing_count": int(trialing),
        "cancelled_count": int(cancelled),
        "cancelled_30d": int(cancelled_30d),
        "churn_rate_30d": round(churn_rate, 4),
        "stripe_dashboard_url": "https://dashboard.stripe.com",
    }


# ─── Usage / metering ───────────────────────────────────────────────

@router.get("/usage")
def get_usage_overview(
    window: str = Query("30d", description="'today'|'7d'|'30d'|'mtd'|'all'"),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    if window == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif window == "7d":
        since = now - timedelta(days=7)
    elif window == "mtd":
        since = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif window == "all":
        since = datetime(2000, 1, 1)
    else:  # default / '30d'
        since = now - timedelta(days=30)

    # Totals across the window
    total_tokens = (
        db.query(func.coalesce(func.sum(UsageEvent.quantity), 0))
        .filter(UsageEvent.kind == "ai_tokens")
        .filter(UsageEvent.created_at >= since).scalar() or 0
    )
    total_cost = (
        db.query(func.coalesce(func.sum(UsageEvent.cost_cents), 0))
        .filter(UsageEvent.kind == "ai_tokens")
        .filter(UsageEvent.created_at >= since).scalar() or 0
    )
    total_uploads = (
        db.query(func.count(UsageEvent.id))
        .filter(UsageEvent.kind == "file_upload")
        .filter(UsageEvent.created_at >= since).scalar() or 0
    )

    # Per-org breakdown
    per_org_rows = (
        db.query(
            UsageEvent.organisation_id,
            func.coalesce(func.sum(UsageEvent.quantity), 0),
            func.coalesce(func.sum(UsageEvent.cost_cents), 0),
            func.max(UsageEvent.created_at),
        )
        .filter(UsageEvent.kind == "ai_tokens")
        .filter(UsageEvent.created_at >= since)
        .group_by(UsageEvent.organisation_id).all()
    )
    orgs_by_id = {o.id: o for o in db.query(Organisation).all()}
    per_org = []
    for org_id, qty, cost, last_used in per_org_rows:
        org = orgs_by_id.get(org_id)
        per_org.append({
            "organisation_id": org_id,
            "organisation_name": org.name if org else "(deleted org)",
            "ai_tokens": int(qty or 0),
            "ai_cost_cents": int(cost or 0),
            "last_used_at": last_used.isoformat() if last_used else None,
        })
    per_org.sort(key=lambda r: r["ai_tokens"], reverse=True)

    return {
        "window": window,
        "since": since.isoformat(),
        "totals": {
            "ai_tokens": int(total_tokens),
            "ai_cost_cents": int(total_cost),
            "uploads": int(total_uploads),
        },
        "per_org": per_org,
    }


# ─── Helper for other routers to log usage ──────────────────────────

def log_usage(db: Session, *, organisation_id: str, user_id: Optional[str],
              kind: str, quantity: int = 0, cost_cents: int = 0,
              meta: Optional[dict] = None) -> None:
    """Tiny helper so /ai/stream and /files/upload can log in one line.

    Deliberately swallows errors — usage metering must never break the
    primary request.
    """
    try:
        db.add(UsageEvent(
            id=str(uuid.uuid4()),
            organisation_id=organisation_id,
            user_id=user_id,
            kind=kind,
            quantity=int(quantity or 0),
            cost_cents=int(cost_cents or 0),
            meta_json=json.dumps(meta) if meta else None,
        ))
        db.commit()
    except Exception as exc:
        logger.warning("log_usage failed (kind=%s): %s", kind, exc)
        try:
            db.rollback()
        except Exception:
            pass
