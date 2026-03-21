from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from database import get_db, User, Organisation
from auth_utils import get_current_user
from config import settings
import stripe
import json

router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

PLAN_PRICES = {
    "starter": {"price_id": settings.STRIPE_STARTER_PRICE_ID, "name": "Starter", "amount": 4900, "max_users": 3, "max_uploads": 10},
    "growth": {"price_id": settings.STRIPE_GROWTH_PRICE_ID, "name": "Growth", "amount": 14900, "max_users": 10, "max_uploads": 999},
    "enterprise": {"price_id": settings.STRIPE_ENTERPRISE_PRICE_ID, "name": "Enterprise", "amount": 49900, "max_users": 999, "max_uploads": 999},
}

@router.get("/plans")
def get_plans():
    return [
        {
            "id": "starter",
            "name": "Starter",
            "price": 99,
            "currency": "gbp",
            "max_users": 3,
            "max_uploads": 10,
            "features": ["3 users", "10 uploads/month", "All core analytics", "Email support"]
        },
        {
            "id": "growth",
            "name": "Growth",
            "price": 249,
            "currency": "gbp",
            "max_users": 10,
            "max_uploads": "Unlimited",
            "features": ["10 users", "Unlimited uploads", "All analytics + AI features", "Scheduled reports", "Priority support"]
        },
        {
            "id": "enterprise",
            "name": "Enterprise",
            "price": null,
            "currency": "gbp",
            "max_users": "Unlimited",
            "max_uploads": "Unlimited",
            "features": ["Unlimited users", "Unlimited uploads", "SSO / SAML", "Data residency", "Dedicated account manager", "SLA guarantee"], "cta": "Contact us"
        },
    ]

@router.post("/create-checkout")
def create_checkout_session(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan_id = body.get("plan_id", "starter")
    if plan_id not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan = PLAN_PRICES[plan_id]
    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=400, detail="No organisation found")

    if not org.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=org.name,
            metadata={"org_id": org.id, "user_id": current_user.id}
        )
        org.stripe_customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=org.stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": plan["price_id"], "quantity": 1}],
        mode="subscription",
        success_url=settings.FRONTEND_URL + "/billing/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=settings.FRONTEND_URL + "/billing",
        metadata={"org_id": org.id, "plan_id": plan_id},
        subscription_data={"trial_period_days": settings.TRIAL_DAYS}
    )

    return {"checkout_url": session.url}

@router.post("/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = current_user.organisation
    if not org or not org.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners can cancel subscriptions")

    stripe.Subscription.modify(org.stripe_subscription_id, cancel_at_period_end=True)
    return {"message": "Subscription will cancel at end of billing period"}

@router.get("/portal")
def billing_portal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = current_user.organisation
    if not org or not org.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=settings.FRONTEND_URL + "/billing"
    )
    return {"portal_url": session.url}

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None), db: Session = Depends(get_db)):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        org_id = session["metadata"].get("org_id")
        plan_id = session["metadata"].get("plan_id", "starter")
        org = db.query(Organisation).filter(Organisation.id == org_id).first()
        if org:
            plan = PLAN_PRICES.get(plan_id, PLAN_PRICES["starter"])
            org.stripe_subscription_id = session.get("subscription")
            org.subscription_status = "active"
            org.subscription_tier = plan_id
            org.max_users = plan["max_users"]
            org.max_uploads_per_month = plan["max_uploads"]
            db.commit()

    elif event["type"] in ["customer.subscription.deleted", "customer.subscription.updated"]:
        sub = event["data"]["object"]
        org = db.query(Organisation).filter(Organisation.stripe_subscription_id == sub["id"]).first()
        if org:
            org.subscription_status = sub["status"]
            db.commit()

    return {"received": True}
