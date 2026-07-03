"""GO Repair CRM - FastAPI backend
Multi-role (super_admin/manager/technician) lead distribution + points wallet.
"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
from typing import Optional, List, Literal

import io
import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}

import sys
sys.path.insert(0, str(ROOT_DIR))
from catalog import CATALOG, SKU_INDEX, CATEGORY_INDEX

# -----------------------------------------------------------------------------
# Config / DB
# -----------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@gorepair.in").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="GO Repair CRM")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # using Bearer token, not cookies (frontend sends Authorization header)
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("gorepair")

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def strip_mongo(doc: dict) -> dict:
    if doc is None:
        return doc
    d = dict(doc)
    d.pop("_id", None)
    d.pop("password_hash", None)
    return d

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found")
    user.pop("password_hash", None)
    return user

def require_roles(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {roles}")
        return user
    return _dep

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
Role = Literal["super_admin", "manager", "technician", "customer"]
LeadStatus = Literal["new", "assigned_manager", "assigned_technician", "in_progress", "completed", "cancelled", "invalid"]
LeadSource = Literal["website", "facebook", "google", "whatsapp", "manual", "referral", "justdial", "customer_app"]
TxnType = Literal["credit", "debit", "refund", "recharge", "brand_kit"]

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role
    phone: Optional[str] = None
    city: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    manager_id: Optional[str] = None  # for technician

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    skills: Optional[List[str]] = None
    active: Optional[bool] = None
    manager_id: Optional[str] = None

class PasswordResetIn(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=64)

class LeadCreate(BaseModel):
    customer_name: str
    phone: str
    address: Optional[str] = None
    city: str
    appliance_type: str
    issue: str
    priority: Literal["low", "medium", "high"] = "medium"
    source: LeadSource = "manual"

class LeadAssignManager(BaseModel):
    manager_id: str

class LeadAssignTech(BaseModel):
    technician_id: str

class LeadStatusUpdate(BaseModel):
    status: LeadStatus
    note: Optional[str] = None
    estimated_cost: Optional[float] = None
    final_cost: Optional[float] = None

class LeadNote(BaseModel):
    text: str

class LeadRating(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class WalletAdjust(BaseModel):
    manager_id: str
    points: int = Field(gt=0)
    reason: Optional[str] = None

class WalletRecharge(BaseModel):
    amount_inr: int = Field(gt=0)

class SettingsUpdate(BaseModel):
    cost_per_lead: Optional[int] = None
    welcome_bonus_points: Optional[int] = None
    upi_vpa: Optional[str] = None
    upi_name: Optional[str] = None

class BrandKitOrderIn(BaseModel):
    items: List[dict]  # [{sku, qty}]

# -----------------------------------------------------------------------------
# Auth endpoints
# -----------------------------------------------------------------------------
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account disabled")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": strip_mongo(user)}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# -----------------------------------------------------------------------------
# Users
# -----------------------------------------------------------------------------
@api.get("/users")
async def list_users(
    role: Optional[Role] = None,
    manager_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if role:
        q["role"] = role
    if manager_id:
        q["manager_id"] = manager_id
    # Managers can only see their own technicians
    if user["role"] == "manager":
        if role and role != "technician":
            raise HTTPException(403, "Managers can only list technicians")
        q["role"] = "technician"
        q["manager_id"] = user["id"]
    elif user["role"] == "technician":
        raise HTTPException(403, "Forbidden")
    items = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(500)
    return items

@api.post("/users")
async def create_user(body: UserCreate, admin: dict = Depends(require_roles("super_admin", "manager"))):
    # Managers can only create technicians under themselves
    if admin["role"] == "manager":
        if body.role != "technician":
            raise HTTPException(403, "Managers can only create technicians")
        body.manager_id = admin["id"]
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already in use")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "phone": body.phone,
        "city": body.city,
        "skills": body.skills,
        "manager_id": body.manager_id if body.role == "technician" else None,
        "wallet_balance": 0 if body.role == "manager" else None,
        "has_brand_kit": False if body.role == "manager" else None,
        "rating": 5.0 if body.role == "technician" else None,
        "jobs_completed": 0 if body.role == "technician" else None,
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return strip_mongo(doc)

@api.patch("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, admin: dict = Depends(require_roles("super_admin", "manager"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User not found")
    if admin["role"] == "manager":
        if target.get("manager_id") != admin["id"] or target.get("role") != "technician":
            raise HTTPException(403, "Not your technician")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.users.update_one({"id": uid}, {"$set": update})
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    return u

@api.post("/users/{uid}/reset-password")
async def reset_user_password(uid: str, body: PasswordResetIn, admin: dict = Depends(require_roles("super_admin", "manager"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User not found")
    # Customers must use their own self-service reset flow (not this admin tool)
    if target.get("role") == "customer":
        raise HTTPException(403, "Cannot reset customer passwords from staff console")
    # Managers can only reset their own technicians
    if admin["role"] == "manager":
        if target.get("role") != "technician" or target.get("manager_id") != admin["id"]:
            raise HTTPException(403, "Not your technician")
    # Block manager from resetting another manager / super_admin
    if admin["role"] == "manager" and target.get("role") in ("manager", "super_admin"):
        raise HTTPException(403, "Forbidden")
    await db.users.update_one(
        {"id": uid},
        {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"ok": True, "user_id": uid, "email": target.get("email")}

# -----------------------------------------------------------------------------
# Settings
# -----------------------------------------------------------------------------
DEFAULT_BRAND_KIT = [
    {"sku": "tshirt", "name": "GO Repair T-Shirt (x3)", "price_points": 600,
     "image": "https://images.unsplash.com/photo-1637531347055-4fa8aa80c111?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBwb2xvJTIwc2hpcnR8ZW58MHx8fHwxNzc2NTM1NDc2fDA&ixlib=rb-4.1.0&q=85",
     "desc": "Branded uniform for technicians. Pack of 3."},
    {"sku": "billbook", "name": "Bill Book (GST Ready)", "price_points": 400,
     "image": "https://images.unsplash.com/photo-1709988795057-a13a7a612046?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMGRpYXJ5JTIwYnJhbmRpbmd8ZW58MHx8fHwxNzc2NTM1NDc2fDA&ixlib=rb-4.1.0&q=85",
     "desc": "100-page carbon-copy bill book with GST format."},
    {"sku": "idcard", "name": "Technician ID Cards (x5)", "price_points": 300,
     "image": "https://images.unsplash.com/photo-1637531347055-4fa8aa80c111?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBwb2xvJTIwc2hpcnR8ZW58MHx8fHwxNzc2NTM1NDc2fDA&ixlib=rb-4.1.0&q=85",
     "desc": "Photo ID with NFC verification tag."},
    {"sku": "toolkit", "name": "Starter Tool Pouch", "price_points": 800,
     "image": "https://images.unsplash.com/photo-1580401410158-1f0b0a406762?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwxfHxhcHBsaWFuY2UlMjB3YXNoaW5nJTIwbWFjaGluZSUyMHJlcGFpciUyMHRvb2xzfGVufDB8fHx8MTc3NjUzNTQ3MXww&ixlib=rb-4.1.0&q=85",
     "desc": "Branded pouch with essential hand tools."},
    {"sku": "flyers", "name": "Marketing Flyers (500)", "price_points": 250,
     "image": "https://images.unsplash.com/photo-1709988795057-a13a7a612046?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMGRpYXJ5JTIwYnJhbmRpbmd8ZW58MHx8fHwxNzc2NTM1NDc2fDA&ixlib=rb-4.1.0&q=85",
     "desc": "A5 local-market flyers for area distribution."},
]

async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {
            "id": "global",
            "cost_per_lead": 200,
            "welcome_bonus_points": 500,
            "upi_vpa": "gorepair@okhdfc",
            "upi_name": "GO Repair",
            "brand_kit_items": DEFAULT_BRAND_KIT,
        }
        await db.settings.insert_one(s)
    if "brand_kit_items" not in s:
        s["brand_kit_items"] = DEFAULT_BRAND_KIT
    if "upi_vpa" not in s:
        s["upi_vpa"] = "gorepair@okhdfc"
    if "upi_name" not in s:
        s["upi_name"] = "GO Repair"
    return s

@api.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    return await get_settings()

@api.put("/settings")
async def update_settings(body: SettingsUpdate, admin: dict = Depends(require_roles("super_admin"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    return await get_settings()

# -----------------------------------------------------------------------------
# Leads
# -----------------------------------------------------------------------------
@api.get("/leads")
async def list_leads(
    status: Optional[str] = None,
    manager_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    source: Optional[str] = None,
    city: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if status: q["status"] = status
    if source: q["source"] = source
    if city: q["city"] = city
    if user["role"] == "super_admin":
        if manager_id: q["manager_id"] = manager_id
        if technician_id: q["technician_id"] = technician_id
    elif user["role"] == "manager":
        q["manager_id"] = user["id"]
        if technician_id: q["technician_id"] = technician_id
    else:  # technician
        q["technician_id"] = user["id"]
    leads = await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leads

@api.get("/leads/cities")
async def list_cities(user: dict = Depends(get_current_user)):
    """Distinct cities present in the leads collection (scoped to role)."""
    match: dict = {}
    if user["role"] == "manager":
        match["manager_id"] = user["id"]
    elif user["role"] == "technician":
        match["technician_id"] = user["id"]
    cities = await db.leads.distinct("city", match)
    return sorted([c for c in cities if c])

@api.post("/leads")
async def create_lead(body: LeadCreate, user: dict = Depends(require_roles("super_admin", "manager"))):
    lid = str(uuid.uuid4())
    # When a manager creates a lead, it's a walk-in / direct customer — auto-assign to them at 0 cost.
    is_manager_walkin = (user["role"] == "manager")
    doc = {
        "id": lid,
        "customer_name": body.customer_name,
        "phone": body.phone,
        "address": body.address,
        "city": body.city,
        "appliance_type": body.appliance_type,
        "issue": body.issue,
        "priority": body.priority,
        "source": body.source,
        "status": "assigned_manager" if is_manager_walkin else "new",
        "manager_id": user["id"] if is_manager_walkin else None,
        "technician_id": None,
        "cost_points": 0,
        "estimated_cost": None,
        "final_cost": None,
        "rating": None,
        "rating_comment": None,
        "notes": [],
        "attachments": [],
        "created_at": now_iso(),
        "assigned_manager_at": now_iso() if is_manager_walkin else None,
        "assigned_technician_at": None,
        "completed_at": None,
    }
    await db.leads.insert_one(doc)
    return strip_mongo(doc)

@api.get("/leads/{lid}")
async def get_lead(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "technician" and lead.get("technician_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    return lead

async def _wallet_txn(manager_id: str, type_: str, points: int, reason: str, lead_id: Optional[str] = None):
    """Atomic-ish wallet update + ledger entry. points positive int; type decides sign."""
    mgr = await db.users.find_one({"id": manager_id})
    if not mgr or mgr.get("role") != "manager":
        raise HTTPException(404, "Manager not found")
    balance = mgr.get("wallet_balance", 0) or 0
    delta = points if type_ in ("credit", "refund", "recharge") else -points
    new_balance = balance + delta
    if new_balance < 0:
        raise HTTPException(400, f"Insufficient wallet balance ({balance} pts, need {points})")
    await db.users.update_one({"id": manager_id}, {"$set": {"wallet_balance": new_balance}})
    txn = {
        "id": str(uuid.uuid4()),
        "manager_id": manager_id,
        "type": type_,
        "points": points,
        "delta": delta,
        "balance_after": new_balance,
        "reason": reason,
        "lead_id": lead_id,
        "created_at": now_iso(),
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)
    return txn

class LeadBulkAssign(BaseModel):
    lead_ids: List[str] = Field(min_length=1, max_length=200)
    manager_id: str
    cost_per_lead: Optional[int] = Field(default=None, ge=0, le=100000)  # admin override

@api.post("/leads/bulk-assign-manager")
async def bulk_assign_manager(body: LeadBulkAssign, admin: dict = Depends(require_roles("super_admin"))):
    settings = await get_settings()
    cost_per = body.cost_per_lead if body.cost_per_lead is not None else settings.get("cost_per_lead", 200)
    # Validate manager
    mgr = await db.users.find_one({"id": body.manager_id, "role": "manager"})
    if not mgr:
        raise HTTPException(404, "Manager not found")
    # Fetch only unassigned + matching leads
    candidates = await db.leads.find(
        {"id": {"$in": body.lead_ids}, "manager_id": None},
        {"_id": 0},
    ).to_list(len(body.lead_ids))
    if not candidates:
        raise HTTPException(400, "No unassigned leads in the selection")
    total_cost = cost_per * len(candidates)
    balance = mgr.get("wallet_balance", 0) or 0
    if balance < total_cost:
        raise HTTPException(400, f"Insufficient wallet balance ({balance} pts, need {total_cost} for {len(candidates)} leads)")
    # Apply one lead at a time so each gets a ledger entry + notification
    assigned = []
    for lead in candidates:
        try:
            await _wallet_txn(body.manager_id, "debit", cost_per, f"Lead purchase (bulk): {lead.get('customer_name')}", lead["id"])
        except HTTPException:
            break
        await db.leads.update_one(
            {"id": lead["id"]},
            {"$set": {
                "manager_id": body.manager_id,
                "status": "assigned_manager",
                "cost_points": cost_per,
                "assigned_manager_at": now_iso(),
            }},
        )
        await send_notification(
            "whatsapp", mgr.get("phone") or mgr["email"], "lead_assigned_manager",
            {"manager_name": mgr["name"], "appliance": lead.get("appliance_type"),
             "customer": lead.get("customer_name"), "city": lead.get("city"), "cost_points": cost_per},
            user_id=mgr["id"], lead_id=lead["id"],
        )
        assigned.append(lead["id"])
    skipped = [lid for lid in body.lead_ids if lid not in assigned]
    return {"assigned": len(assigned), "skipped": len(skipped), "assigned_ids": assigned, "skipped_ids": skipped, "total_debited": cost_per * len(assigned), "cost_per_lead": cost_per}

@api.post("/leads/{lid}/assign-manager")
async def assign_manager(lid: str, body: LeadAssignManager, admin: dict = Depends(require_roles("super_admin"))):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.get("manager_id"):
        raise HTTPException(400, "Lead already assigned to a manager")
    settings = await get_settings()
    cost = settings.get("cost_per_lead", 200)
    await _wallet_txn(body.manager_id, "debit", cost, f"Lead purchase: {lead.get('customer_name')}", lid)
    await db.leads.update_one(
        {"id": lid},
        {"$set": {
            "manager_id": body.manager_id,
            "status": "assigned_manager",
            "cost_points": cost,
            "assigned_manager_at": now_iso(),
        }},
    )
    # Notify manager
    mgr = await db.users.find_one({"id": body.manager_id}, {"_id": 0, "password_hash": 0})
    if mgr:
        await send_notification(
            "whatsapp", mgr.get("phone") or mgr["email"], "lead_assigned_manager",
            {"manager_name": mgr["name"], "appliance": lead.get("appliance_type"),
             "customer": lead.get("customer_name"), "city": lead.get("city"), "cost_points": cost},
            user_id=mgr["id"], lead_id=lid,
        )
    return await db.leads.find_one({"id": lid}, {"_id": 0})

@api.post("/leads/{lid}/assign-technician")
async def assign_technician(lid: str, body: LeadAssignTech, user: dict = Depends(require_roles("manager", "super_admin"))):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Not your lead")
    if lead.get("status") in ("completed", "cancelled", "invalid"):
        raise HTTPException(400, f"Cannot reassign a {lead['status']} job")
    tech = await db.users.find_one({"id": body.technician_id, "role": "technician"})
    if not tech:
        raise HTTPException(404, "Technician not found")
    prev_tech_id = lead.get("technician_id")
    if prev_tech_id == body.technician_id:
        raise HTTPException(400, "Technician is already assigned to this job")

    now = now_iso()
    reassign_note = {
        "at": now,
        "by": user["id"],
        "by_name": user.get("name"),
        "from": prev_tech_id,
        "to": body.technician_id,
    }
    update = {
        "technician_id": body.technician_id,
        "status": "assigned_technician",
        "assigned_technician_at": now,
    }
    if prev_tech_id:
        update["last_reassigned_at"] = now
    await db.leads.update_one(
        {"id": lid},
        {
            "$set": update,
            "$push": {"reassignment_history": reassign_note},
        },
    )
    # Notify the newly assigned technician
    await send_notification(
        "whatsapp", tech.get("phone") or tech["email"],
        "lead_reassigned_technician" if prev_tech_id else "lead_assigned_technician",
        {"tech_name": tech["name"], "appliance": lead.get("appliance_type"),
         "customer": lead.get("customer_name"), "city": lead.get("city"), "priority": lead.get("priority")},
        user_id=tech["id"], lead_id=lid,
    )
    # If this was a reassignment, notify the previous technician they were removed
    if prev_tech_id and prev_tech_id != body.technician_id:
        prev_tech = await db.users.find_one({"id": prev_tech_id})
        if prev_tech:
            await send_notification(
                "whatsapp", prev_tech.get("phone") or prev_tech["email"], "lead_removed_from_technician",
                {"tech_name": prev_tech["name"], "appliance": lead.get("appliance_type"),
                 "customer": lead.get("customer_name"), "city": lead.get("city")},
                user_id=prev_tech["id"], lead_id=lid,
            )
    return await db.leads.find_one({"id": lid}, {"_id": 0})

@api.post("/leads/{lid}/status")
async def update_status(lid: str, body: LeadStatusUpdate, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "technician" and lead.get("technician_id") != user["id"]:
        raise HTTPException(403, "Not your job")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Not your lead")
    update = {"status": body.status}
    if body.estimated_cost is not None:
        update["estimated_cost"] = body.estimated_cost
    if body.final_cost is not None:
        update["final_cost"] = body.final_cost
    if body.status == "completed":
        update["completed_at"] = now_iso()
        # bump tech stats
        if lead.get("technician_id"):
            await db.users.update_one(
                {"id": lead["technician_id"]},
                {"$inc": {"jobs_completed": 1}},
            )
    if body.note:
        await db.leads.update_one(
            {"id": lid},
            {"$push": {"notes": {"id": str(uuid.uuid4()), "by": user["id"], "by_name": user["name"], "text": body.note, "at": now_iso()}}},
        )
    # Refund for invalid leads
    if body.status == "invalid" and lead.get("manager_id") and not lead.get("refunded"):
        refund = int((lead.get("cost_points") or 0) * 0.8)
        if refund > 0:
            await _wallet_txn(lead["manager_id"], "refund", refund, f"Invalid lead refund (80%): {lead.get('customer_name')}", lid)
            update["refunded"] = True
    await db.leads.update_one({"id": lid}, {"$set": update})
    # Notify customer on status change (completed / cancelled / in_progress)
    tech = await db.users.find_one({"id": lead.get("technician_id")}, {"_id": 0, "password_hash": 0}) if lead.get("technician_id") else None
    if body.status in ("in_progress", "completed", "cancelled"):
        tpl = "lead_completed_customer" if body.status == "completed" else "lead_status_customer"
        await send_notification(
            "sms", lead.get("phone") or "unknown", tpl,
            {"customer": lead.get("customer_name"), "appliance": lead.get("appliance_type"),
             "status": body.status.replace("_", " "), "tech_name": (tech or {}).get("name", "our technician"),
             "final_cost": body.final_cost or lead.get("final_cost") or 0},
            lead_id=lid,
        )
    return await db.leads.find_one({"id": lid}, {"_id": 0})

@api.post("/leads/{lid}/notes")
async def add_note(lid: str, body: LeadNote, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "technician" and lead.get("technician_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    note = {"id": str(uuid.uuid4()), "by": user["id"], "by_name": user["name"], "text": body.text, "at": now_iso()}
    await db.leads.update_one({"id": lid}, {"$push": {"notes": note}})
    return note

@api.post("/leads/{lid}/rating")
async def rate_lead(lid: str, body: LeadRating, user: dict = Depends(require_roles("manager", "super_admin"))):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.leads.update_one({"id": lid}, {"$set": {"rating": body.stars, "rating_comment": body.comment}})
    # Update technician avg rating
    if lead.get("technician_id"):
        pipeline = [
            {"$match": {"technician_id": lead["technician_id"], "rating": {"$ne": None}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
        ]
        res = await db.leads.aggregate(pipeline).to_list(1)
        if res:
            await db.users.update_one({"id": lead["technician_id"]}, {"$set": {"rating": round(res[0]["avg"], 2)}})
    return await db.leads.find_one({"id": lid}, {"_id": 0})

# -----------------------------------------------------------------------------
# Wallet
# -----------------------------------------------------------------------------
@api.get("/wallet/me")
async def wallet_me(user: dict = Depends(require_roles("manager"))):
    return {"balance": user.get("wallet_balance", 0) or 0}

@api.get("/wallet/transactions")
async def wallet_txns(
    manager_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "manager":
        q["manager_id"] = user["id"]
    elif user["role"] == "super_admin":
        if manager_id:
            q["manager_id"] = manager_id
    else:
        raise HTTPException(403, "Forbidden")
    txns = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return txns

@api.post("/wallet/credit")
async def wallet_credit(body: WalletAdjust, admin: dict = Depends(require_roles("super_admin"))):
    txn = await _wallet_txn(body.manager_id, "credit", body.points, body.reason or "Admin credit")
    return txn

@api.post("/wallet/debit")
async def wallet_debit(body: WalletAdjust, admin: dict = Depends(require_roles("super_admin"))):
    txn = await _wallet_txn(body.manager_id, "debit", body.points, body.reason or "Admin debit")
    return txn

@api.post("/wallet/recharge")
async def wallet_recharge(body: WalletRecharge, user: dict = Depends(require_roles("manager"))):
    # MOCKED recharge: ₹1 = 1 point. Razorpay integration planned for Phase 2.
    points = body.amount_inr
    txn = await _wallet_txn(user["id"], "recharge", points, f"Recharge ₹{body.amount_inr} (mock)")
    return {"ok": True, "txn": txn, "mode": "mock"}

# -----------------------------------------------------------------------------
# UPI QR-code recharge requests (manager pays via UPI, uploads receipt, admin approves)
# -----------------------------------------------------------------------------
@api.get("/wallet/upi-config")
async def upi_config(user: dict = Depends(get_current_user)):
    s = await get_settings()
    return {"upi_vpa": s.get("upi_vpa", ""), "upi_name": s.get("upi_name", "GO Repair")}

@api.post("/wallet/recharge-request")
async def create_recharge_request(
    amount_inr: int = Query(..., gt=0, le=200000),
    note: Optional[str] = Query(None),
    receipt: UploadFile = File(...),
    user: dict = Depends(require_roles("manager")),
):
    name = receipt.filename or "receipt"
    ext = ("." + name.rsplit(".", 1)[-1]).lower() if "." in name else ""
    if ext not in ALLOWED_IMAGE_EXT and ext != ".pdf":
        raise HTTPException(400, "Receipt must be an image or PDF")
    contents = await receipt.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8 MB)")
    fname = f"receipt_{user['id'][:8]}_{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / fname
    with open(path, "wb") as f:
        f.write(contents)
    doc = {
        "id": str(uuid.uuid4()),
        "manager_id": user["id"],
        "manager_name": user["name"],
        "manager_email": user["email"],
        "amount_inr": amount_inr,
        "points": amount_inr,  # 1:1 conversion
        "receipt_url": f"/api/uploads/{fname}",
        "receipt_filename": name,
        "note": note or "",
        "status": "pending",
        "admin_note": "",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now_iso(),
    }
    await db.recharge_requests.insert_one(doc)
    # Notify admins via mock notification system
    admins = await db.users.find({"role": "super_admin"}).to_list(10)
    for a in admins:
        await send_notification(
            "push", a.get("phone") or a["email"], "wallet_low",
            {"balance": amount_inr},
            user_id=a["id"],
        )
    doc.pop("_id", None)
    return doc

@api.get("/wallet/recharge-requests")
async def list_recharge_requests(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if status:
        q["status"] = status
    if user["role"] == "manager":
        q["manager_id"] = user["id"]
    elif user["role"] != "super_admin":
        raise HTTPException(403, "Forbidden")
    items = await db.recharge_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

class RechargeReviewIn(BaseModel):
    admin_note: Optional[str] = None

@api.post("/wallet/recharge-requests/{rid}/approve")
async def approve_recharge(rid: str, body: RechargeReviewIn, admin: dict = Depends(require_roles("super_admin"))):
    req = await db.recharge_requests.find_one({"id": rid})
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, f"Already {req['status']}")
    txn = await _wallet_txn(
        req["manager_id"], "recharge", req["points"],
        f"UPI recharge ₹{req['amount_inr']} (approved)",
    )
    await db.recharge_requests.update_one(
        {"id": rid},
        {"$set": {
            "status": "approved",
            "admin_note": body.admin_note or "",
            "reviewed_by": admin["id"],
            "reviewed_at": now_iso(),
            "txn_id": txn["id"],
        }},
    )
    return {"ok": True, "txn": txn}

@api.post("/wallet/recharge-requests/{rid}/reject")
async def reject_recharge(rid: str, body: RechargeReviewIn, admin: dict = Depends(require_roles("super_admin"))):
    req = await db.recharge_requests.find_one({"id": rid})
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, f"Already {req['status']}")
    await db.recharge_requests.update_one(
        {"id": rid},
        {"$set": {
            "status": "rejected",
            "admin_note": body.admin_note or "Rejected",
            "reviewed_by": admin["id"],
            "reviewed_at": now_iso(),
        }},
    )
    return {"ok": True}

# -----------------------------------------------------------------------------
# Brand Kit
# -----------------------------------------------------------------------------
@api.get("/brand-kit/items")
async def brand_kit_items(user: dict = Depends(get_current_user)):
    s = await get_settings()
    return s.get("brand_kit_items", DEFAULT_BRAND_KIT)

@api.post("/brand-kit/order")
async def order_brand_kit(body: BrandKitOrderIn, user: dict = Depends(require_roles("manager"))):
    s = await get_settings()
    catalog = {it["sku"]: it for it in s.get("brand_kit_items", DEFAULT_BRAND_KIT)}
    total = 0
    items = []
    for it in body.items:
        sku = it.get("sku")
        qty = int(it.get("qty", 1))
        if sku not in catalog or qty < 1:
            raise HTTPException(400, f"Invalid item: {sku}")
        price = catalog[sku]["price_points"]
        total += price * qty
        items.append({"sku": sku, "name": catalog[sku]["name"], "qty": qty, "price_points": price})
    if total <= 0:
        raise HTTPException(400, "Empty order")
    await _wallet_txn(user["id"], "brand_kit", total, "Brand Kit order")
    order = {
        "id": str(uuid.uuid4()),
        "manager_id": user["id"],
        "items": items,
        "total_points": total,
        "status": "processing",
        "created_at": now_iso(),
    }
    await db.brand_kit_orders.insert_one(order)
    await db.users.update_one({"id": user["id"]}, {"$set": {"has_brand_kit": True}})
    return strip_mongo(order)

@api.get("/brand-kit/orders")
async def list_brand_kit_orders(user: dict = Depends(get_current_user)):
    q = {} if user["role"] == "super_admin" else {"manager_id": user["id"]}
    orders = await db.brand_kit_orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return orders

# -----------------------------------------------------------------------------
# Analytics
# -----------------------------------------------------------------------------
@api.get("/analytics/overview")
async def analytics_overview(user: dict = Depends(get_current_user)):
    lead_match: dict = {}
    if user["role"] == "manager":
        lead_match["manager_id"] = user["id"]
    elif user["role"] == "technician":
        lead_match["technician_id"] = user["id"]
    total = await db.leads.count_documents(lead_match)
    completed = await db.leads.count_documents({**lead_match, "status": "completed"})
    in_progress = await db.leads.count_documents({**lead_match, "status": {"$in": ["assigned_technician", "in_progress"]}})
    cancelled = await db.leads.count_documents({**lead_match, "status": {"$in": ["cancelled", "invalid"]}})
    new_leads = await db.leads.count_documents({**lead_match, "status": "new"})
    revenue_pipe = [
        {"$match": {**lead_match, "status": "completed", "final_cost": {"$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$final_cost"}}},
    ]
    rev = await db.leads.aggregate(revenue_pipe).to_list(1)
    revenue = rev[0]["total"] if rev else 0
    # by source
    src_pipe = [
        {"$match": lead_match},
        {"$group": {"_id": "$source", "count": {"$sum": 1},
                    "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}}}},
    ]
    sources = await db.leads.aggregate(src_pipe).to_list(20)
    # points spent
    points_spent = 0
    if user["role"] == "manager":
        pp = [
            {"$match": {"manager_id": user["id"], "type": {"$in": ["debit", "brand_kit"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$points"}}},
        ]
        r = await db.transactions.aggregate(pp).to_list(1)
        points_spent = r[0]["total"] if r else 0
    return {
        "total_leads": total,
        "new_leads": new_leads,
        "in_progress": in_progress,
        "completed": completed,
        "cancelled": cancelled,
        "conversion_rate": round(completed / total * 100, 1) if total else 0,
        "revenue": revenue,
        "points_spent": points_spent,
        "sources": [{"source": s["_id"], "count": s["count"], "completed": s["completed"]} for s in sources],
    }

@api.get("/analytics/technicians")
async def analytics_technicians(user: dict = Depends(require_roles("super_admin", "manager"))):
    q = {"role": "technician"}
    if user["role"] == "manager":
        q["manager_id"] = user["id"]
    techs = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(200)
    out = []
    for t in techs:
        match = {"technician_id": t["id"]}
        total = await db.leads.count_documents(match)
        done = await db.leads.count_documents({**match, "status": "completed"})
        out.append({
            "id": t["id"],
            "name": t["name"],
            "city": t.get("city"),
            "rating": t.get("rating", 5.0),
            "jobs_completed": t.get("jobs_completed", 0),
            "active_jobs": total - done,
            "total_leads": total,
        })
    out.sort(key=lambda x: (-x["rating"], -x["jobs_completed"]))
    return out

# -----------------------------------------------------------------------------
# AI Smart Assign (Claude Sonnet 4.5 via emergentintegrations)
# -----------------------------------------------------------------------------
@api.post("/leads/{lid}/ai-suggest")
async def ai_suggest(lid: str, user: dict = Depends(require_roles("manager", "super_admin"))):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    # candidate technicians
    q = {"role": "technician", "active": True}
    if user["role"] == "manager":
        q["manager_id"] = user["id"]
    techs = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(100)
    if not techs:
        return {"suggestions": [], "reasoning": "No active technicians available."}
    # Compact tech profile for the LLM
    tech_list = [
        {
            "id": t["id"],
            "name": t["name"],
            "city": t.get("city"),
            "skills": t.get("skills", []),
            "rating": t.get("rating", 5.0),
            "jobs_completed": t.get("jobs_completed", 0),
        }
        for t in techs
    ]
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json as _json
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"assign-{lid}",
            system_message=(
                "You are a dispatch optimizer for an appliance repair CRM in India. "
                "Given a lead and technician list, return JSON ONLY (no prose) of the form "
                '{"suggestions":[{"technician_id":"...","score":0-100,"reason":"short"}]}. '
                "Rank by: city match, skill match (appliance type), rating, lower active workload. "
                "Return top 3."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"LEAD: {_json.dumps({'city': lead.get('city'), 'appliance': lead.get('appliance_type'), 'issue': lead.get('issue'), 'priority': lead.get('priority')})}\n"
            f"TECHNICIANS: {_json.dumps(tech_list)}\n"
            "Return JSON only."
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp).strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip()
        data = _json.loads(text)
        # enrich with names
        tmap = {t["id"]: t for t in tech_list}
        enriched = []
        for s in data.get("suggestions", [])[:3]:
            tid = s.get("technician_id")
            if tid in tmap:
                enriched.append({
                    "technician_id": tid,
                    "name": tmap[tid]["name"],
                    "city": tmap[tid].get("city"),
                    "rating": tmap[tid].get("rating"),
                    "score": s.get("score", 0),
                    "reason": s.get("reason", ""),
                })
        return {"suggestions": enriched, "source": "claude-sonnet-4-5"}
    except Exception as e:
        log.warning(f"AI suggest failed, using heuristic: {e}")
        # Fallback heuristic
        scored = []
        for t in tech_list:
            score = 0
            reasons = []
            if t.get("city") and lead.get("city") and t["city"].lower() == lead["city"].lower():
                score += 40; reasons.append("same city")
            if lead.get("appliance_type") and any(lead["appliance_type"].lower() in (s or "").lower() for s in t.get("skills", [])):
                score += 30; reasons.append("skill match")
            score += int((t.get("rating", 5) or 5) * 4)
            scored.append({
                "technician_id": t["id"], "name": t["name"], "city": t.get("city"),
                "rating": t.get("rating"), "score": score, "reason": ", ".join(reasons) or "general fit",
            })
        scored.sort(key=lambda x: -x["score"])
        return {"suggestions": scored[:3], "source": "heuristic"}

# -----------------------------------------------------------------------------
# Attachments (image upload on technician notes)
# -----------------------------------------------------------------------------
@api.post("/leads/{lid}/attachments")
async def upload_attachment(lid: str, file: UploadFile = File(...), caption: Optional[str] = None, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "technician" and lead.get("technician_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    # Validate extension
    name = file.filename or "photo"
    ext = ("." + name.rsplit(".", 1)[-1]).lower() if "." in name else ""
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(400, f"Unsupported file type. Allowed: {sorted(ALLOWED_IMAGE_EXT)}")
    # Read (size cap 8 MB)
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8 MB)")
    fname = f"{lid}_{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / fname
    with open(path, "wb") as f:
        f.write(contents)
    url = f"/api/uploads/{fname}"
    att = {
        "id": str(uuid.uuid4()),
        "url": url,
        "filename": name,
        "size": len(contents),
        "caption": caption or "",
        "by": user["id"],
        "by_name": user["name"],
        "at": now_iso(),
    }
    await db.leads.update_one({"id": lid}, {"$push": {"attachments": att}})
    return att

@api.get("/leads/{lid}/attachments")
async def list_attachments(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "technician" and lead.get("technician_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    return lead.get("attachments") or []

# -----------------------------------------------------------------------------
# GST Invoice (PDF)
# -----------------------------------------------------------------------------
@api.get("/leads/{lid}/invoice")
async def download_invoice(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if user["role"] == "manager" and lead.get("manager_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "technician" and lead.get("technician_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if lead.get("status") != "completed":
        raise HTTPException(400, "Invoice available only for completed jobs")
    if not lead.get("final_cost"):
        raise HTTPException(400, "Set final_cost before generating invoice")

    manager = await db.users.find_one({"id": lead.get("manager_id")}, {"_id": 0, "password_hash": 0}) if lead.get("manager_id") else None
    technician = await db.users.find_one({"id": lead.get("technician_id")}, {"_id": 0, "password_hash": 0}) if lead.get("technician_id") else None

    pdf_bytes = _build_invoice_pdf(lead, manager, technician)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="GoRepair_Invoice_{lid[:8]}.pdf"'},
    )


def _build_invoice_pdf(lead: dict, manager: Optional[dict], technician: Optional[dict]) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas as pdfcanvas

    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    W, H = A4
    OR = colors.HexColor("#FF5F1F")
    INK = colors.HexColor("#0A0A0A")
    MUTED = colors.HexColor("#71717A")

    # Header band
    c.setFillColor(INK); c.rect(0, H - 30 * mm, W, 30 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(18 * mm, H - 15 * mm, "GO")
    c.setFillColor(OR); c.rect(18 * mm + 14 * mm, H - 18 * mm, 5 * mm, 5 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.drawString(18 * mm + 22 * mm, H - 15 * mm, "REPAIR")
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, H - 22 * mm, "Tax Invoice (GST)")

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - 18 * mm, H - 12 * mm, f"Invoice #{lead['id'][:8].upper()}")
    c.setFont("Helvetica", 9)
    c.drawRightString(W - 18 * mm, H - 18 * mm, f"Date: {datetime.now(IST).strftime('%d %b %Y')}")
    c.drawRightString(W - 18 * mm, H - 23 * mm, "GSTIN: 07AAACG0000Z1Z5")

    # Billed to
    y = H - 42 * mm
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 8)
    c.drawString(18 * mm, y, "BILLED TO")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 12)
    c.drawString(18 * mm, y - 6 * mm, lead.get("customer_name", "—"))
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, y - 11 * mm, f"Phone: {lead.get('phone', '—')}")
    addr = lead.get("address") or ""
    c.drawString(18 * mm, y - 16 * mm, (addr[:70] + ("…" if len(addr) > 70 else "")))
    c.drawString(18 * mm, y - 21 * mm, f"{lead.get('city', '')}")

    # Service provider
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 8)
    c.drawString(110 * mm, y, "SERVICED BY")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 12)
    c.drawString(110 * mm, y - 6 * mm, (technician or {}).get("name", "—"))
    c.setFont("Helvetica", 9)
    c.drawString(110 * mm, y - 11 * mm, f"Manager: {(manager or {}).get('name', '—')}")
    c.drawString(110 * mm, y - 16 * mm, f"City: {(technician or {}).get('city', '—')}")

    # Line items table
    y = H - 80 * mm
    c.setFillColor(colors.HexColor("#F4F4F5"))
    c.rect(18 * mm, y - 8 * mm, W - 36 * mm, 8 * mm, fill=1, stroke=0)
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 8)
    c.drawString(20 * mm, y - 5.5 * mm, "DESCRIPTION")
    c.drawRightString(130 * mm, y - 5.5 * mm, "APPLIANCE")
    c.drawRightString(W - 20 * mm, y - 5.5 * mm, "AMOUNT")

    c.setFillColor(INK); c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y - 15 * mm, f"Repair service — {lead.get('issue','')[:50]}")
    c.drawRightString(130 * mm, y - 15 * mm, lead.get("appliance_type", "—"))
    subtotal = float(lead.get("final_cost") or 0.0)
    c.drawRightString(W - 20 * mm, y - 15 * mm, f"₹ {subtotal:,.2f}")

    # Totals (18% GST split 9% CGST + 9% SGST — as taxable value inclusive? We'll compute exclusive)
    gst_rate = 0.18
    taxable = round(subtotal / (1 + gst_rate), 2)
    total_gst = round(subtotal - taxable, 2)
    cgst = round(total_gst / 2, 2)
    sgst = round(total_gst - cgst, 2)

    ty = y - 28 * mm
    c.setStrokeColor(colors.HexColor("#E4E4E7"))
    c.line(120 * mm, ty + 4 * mm, W - 20 * mm, ty + 4 * mm)
    c.setFont("Helvetica", 9); c.setFillColor(MUTED)
    c.drawRightString(160 * mm, ty - 2 * mm, "Taxable value")
    c.drawRightString(160 * mm, ty - 8 * mm, "CGST @ 9%")
    c.drawRightString(160 * mm, ty - 14 * mm, "SGST @ 9%")
    c.setFillColor(INK); c.setFont("Helvetica", 10)
    c.drawRightString(W - 20 * mm, ty - 2 * mm, f"₹ {taxable:,.2f}")
    c.drawRightString(W - 20 * mm, ty - 8 * mm, f"₹ {cgst:,.2f}")
    c.drawRightString(W - 20 * mm, ty - 14 * mm, f"₹ {sgst:,.2f}")

    c.setFillColor(OR); c.rect(120 * mm, ty - 24 * mm, W - 20 * mm - 120 * mm, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 11)
    c.drawRightString(160 * mm, ty - 21 * mm, "TOTAL")
    c.drawRightString(W - 20 * mm, ty - 21 * mm, f"₹ {subtotal:,.2f}")

    # Footer
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawString(18 * mm, 20 * mm, "Thank you for choosing GO Repair. Payment is due on receipt.")
    c.drawString(18 * mm, 16 * mm, "This is a computer-generated invoice and does not require a signature.")
    c.drawRightString(W - 18 * mm, 16 * mm, "support@gorepair.in  ·  +91 9000 000 000")

    c.showPage(); c.save()
    return buf.getvalue()

# -----------------------------------------------------------------------------
# Notifications (MOCK — logs + stores to DB; swap provider via env later)
# -----------------------------------------------------------------------------
NOTIFY_LOG = logging.getLogger("gorepair.notify")

async def send_notification(channel: str, to: str, template: str, ctx: dict, user_id: Optional[str] = None, lead_id: Optional[str] = None):
    """Channel = sms | whatsapp | push. MOCKED: writes to notifications collection and logs."""
    body = _render_template(template, ctx)
    doc = {
        "id": str(uuid.uuid4()),
        "channel": channel,
        "to": to,
        "template": template,
        "body": body,
        "status": "mocked",
        "user_id": user_id,
        "lead_id": lead_id,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    NOTIFY_LOG.info(f"[NOTIFY:{channel}] to={to} :: {body}")
    doc.pop("_id", None)
    return doc

TEMPLATES = {
    "lead_assigned_manager": "Hi {manager_name}, a new {appliance} lead for {customer} ({city}) has been assigned to you on GO Repair. {cost_points} pts debited.",
    "lead_assigned_technician": "Hi {tech_name}, you've been assigned a {appliance} job for {customer} at {city}. Priority: {priority}. Open the app to proceed.",
    "lead_status_customer": "Hi {customer}, your {appliance} service with GO Repair is now {status}. Technician: {tech_name}. Track: gorepair.in",
    "lead_completed_customer": "Hi {customer}, your {appliance} repair is completed. Final bill: ₹{final_cost}. Thank you for choosing GO Repair!",
    "wallet_low": "GO Repair alert: wallet balance is low ({balance} pts). Recharge to keep receiving leads.",
}

def _render_template(key: str, ctx: dict) -> str:
    tpl = TEMPLATES.get(key, key)
    try:
        return tpl.format(**ctx)
    except Exception:
        return tpl

@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    q: dict = {}
    if user["role"] != "super_admin":
        q["$or"] = [{"user_id": user["id"]}, {"to": user.get("phone")}]
    items = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return items

# -----------------------------------------------------------------------------
# GPS / Live technician tracking
# -----------------------------------------------------------------------------
class LocationIn(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None

@api.post("/technicians/me/location")
async def push_location(body: LocationIn, user: dict = Depends(require_roles("technician"))):
    loc = {"lat": body.lat, "lng": body.lng, "accuracy": body.accuracy, "updated_at": now_iso()}
    await db.users.update_one({"id": user["id"]}, {"$set": {"location": loc}})
    return loc

@api.get("/technicians/locations")
async def technician_locations(user: dict = Depends(require_roles("super_admin", "manager"))):
    q = {"role": "technician", "active": True}
    if user["role"] == "manager":
        q["manager_id"] = user["id"]
    techs = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(200)
    out = []
    for t in techs:
        out.append({
            "id": t["id"], "name": t["name"], "city": t.get("city"),
            "phone": t.get("phone"), "rating": t.get("rating", 5.0),
            "skills": t.get("skills", []),
            "location": t.get("location"),
        })
    return out

# -----------------------------------------------------------------------------
# Bulk CSV import (leads)
# -----------------------------------------------------------------------------
@api.post("/leads/bulk-import")
async def bulk_import_leads(file: UploadFile = File(...), admin: dict = Depends(require_roles("super_admin"))):
    import csv as _csv
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(400, "CSV too large (max 5 MB)")
    text = contents.decode("utf-8-sig", errors="ignore")
    reader = _csv.reader(text.splitlines())
    rows = list(reader)
    if not rows:
        raise HTTPException(400, "Empty CSV")
    # Detect header
    header = [h.strip().lower() for h in rows[0]]
    expected = {"customer_name", "phone", "city", "address", "appliance_type", "issue", "priority", "source"}
    has_header = expected.issubset(set(header))
    data_rows = rows[1:] if has_header else rows
    if has_header:
        idx = {k: header.index(k) for k in header if k in expected}
    else:
        # Assumed order: customer_name,phone,city,address,appliance_type,issue,priority,source
        order = ["customer_name", "phone", "city", "address", "appliance_type", "issue", "priority", "source"]
        idx = {k: i for i, k in enumerate(order)}

    allowed_priority = {"low", "medium", "high"}
    allowed_source = {"website", "facebook", "google", "whatsapp", "manual", "referral", "justdial"}

    created, skipped, errors = 0, 0, []
    docs = []
    for rn, row in enumerate(data_rows, start=(2 if has_header else 1)):
        if not row or all(not (c or "").strip() for c in row):
            continue
        try:
            get = lambda k, d="": (row[idx[k]].strip() if idx.get(k, -1) < len(row) and row[idx[k]] else d)
            name = get("customer_name"); phone = get("phone"); city = get("city")
            if not name or not phone or not city:
                skipped += 1; errors.append(f"Row {rn}: missing name/phone/city"); continue
            priority = (get("priority", "medium") or "medium").lower()
            if priority not in allowed_priority: priority = "medium"
            source = (get("source", "manual") or "manual").lower()
            if source not in allowed_source: source = "manual"
            docs.append({
                "id": str(uuid.uuid4()),
                "customer_name": name, "phone": phone, "city": city,
                "address": get("address") or None,
                "appliance_type": get("appliance_type", "Other") or "Other",
                "issue": get("issue") or "—",
                "priority": priority, "source": source,
                "status": "new",
                "manager_id": None, "technician_id": None,
                "cost_points": 0, "estimated_cost": None, "final_cost": None,
                "rating": None, "rating_comment": None,
                "notes": [], "attachments": [],
                "created_at": now_iso(),
                "assigned_manager_at": None, "assigned_technician_at": None, "completed_at": None,
            })
            created += 1
        except Exception as e:
            skipped += 1; errors.append(f"Row {rn}: {e}")
    if docs:
        await db.leads.insert_many(docs)
    return {"created": created, "skipped": skipped, "errors": errors[:20]}

# -----------------------------------------------------------------------------
# Razorpay (real when keys present; otherwise MOCK)
# -----------------------------------------------------------------------------
class RzpOrderIn(BaseModel):
    amount_inr: int = Field(gt=0, le=200000)

class RzpVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: Optional[str] = None
    amount_inr: int

def _rzp_keys():
    kid = (os.environ.get("RAZORPAY_KEY_ID") or "").strip()
    sec = (os.environ.get("RAZORPAY_KEY_SECRET") or "").strip()
    return (kid, sec) if kid and sec else (None, None)

@api.get("/wallet/razorpay/config")
async def rzp_config(user: dict = Depends(require_roles("manager"))):
    kid, _ = _rzp_keys()
    return {"mode": "live" if kid else "mock", "key_id": kid or ""}

@api.post("/wallet/razorpay/create-order")
async def rzp_create_order(body: RzpOrderIn, user: dict = Depends(require_roles("manager"))):
    kid, sec = _rzp_keys()
    order_payload = {"amount": body.amount_inr * 100, "currency": "INR", "receipt": f"gr_{uuid.uuid4().hex[:10]}"}
    if kid:
        import razorpay
        c = razorpay.Client(auth=(kid, sec))
        order = c.order.create(order_payload)
        # track expected amount for verify-step cross-check
        await db.razorpay_orders.insert_one({"order_id": order["id"], "amount_inr": body.amount_inr, "manager_id": user["id"], "created_at": now_iso()})
        return {"mode": "live", "key_id": kid, "order": {"id": order["id"], "amount": order["amount"], "currency": order["currency"]}}
    # MOCK
    oid = f"order_MOCK_{uuid.uuid4().hex[:12]}"
    await db.razorpay_orders.insert_one({"order_id": oid, "amount_inr": body.amount_inr, "manager_id": user["id"], "created_at": now_iso()})
    return {"mode": "mock", "key_id": "rzp_test_MOCK", "order": {"id": oid, "amount": body.amount_inr * 100, "currency": "INR"}}

@api.post("/wallet/razorpay/verify")
async def rzp_verify(body: RzpVerifyIn, user: dict = Depends(require_roles("manager"))):
    kid, sec = _rzp_keys()
    # Cross-check amount matches the order we created (prevents client tampering in mock mode)
    order = await db.razorpay_orders.find_one({"order_id": body.razorpay_order_id, "manager_id": user["id"]})
    if not order:
        raise HTTPException(400, "Unknown or expired order")
    if order["amount_inr"] != body.amount_inr:
        raise HTTPException(400, "Amount mismatch with original order")
    if kid and body.razorpay_signature:
        import razorpay
        c = razorpay.Client(auth=(kid, sec))
        try:
            c.utility.verify_payment_signature({
                "razorpay_order_id": body.razorpay_order_id,
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except Exception as e:
            raise HTTPException(400, f"Signature verification failed: {e}")
    txn = await _wallet_txn(user["id"], "recharge", body.amount_inr, f"Razorpay{' (mock)' if not kid else ''} order {body.razorpay_order_id}")
    await db.razorpay_orders.delete_one({"order_id": body.razorpay_order_id})
    return {"ok": True, "mode": "live" if kid else "mock", "txn": txn}

# -----------------------------------------------------------------------------
# CUSTOMER-FACING APP — registration, catalog, booking
# -----------------------------------------------------------------------------
class CustomerRegister(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=6, max_length=80)
    email: Optional[EmailStr] = None
    city: Optional[str] = None

class CustomerLogin(BaseModel):
    phone: str
    password: str

class AddressIn(BaseModel):
    label: str = "Home"
    line1: str
    line2: Optional[str] = None
    city: str
    pincode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class BookingCreate(BaseModel):
    service_sku: str
    address_id: Optional[str] = None
    address: Optional[AddressIn] = None
    slot_date: str  # ISO date YYYY-MM-DD
    slot_window: str  # e.g. "10:00-12:00"
    issue_note: Optional[str] = None

@api.post("/customer/register")
async def customer_register(body: CustomerRegister):
    phone = body.phone.strip()
    if await db.users.find_one({"$or": [{"phone": phone, "role": "customer"}, {"email": (body.email or "").lower(), "role": "customer"} if body.email else {"_": "_"}]}):
        raise HTTPException(400, "Account already exists with this phone or email")
    uid = str(uuid.uuid4())
    email = (body.email or f"{phone}@customer.gorepair.in").lower()
    doc = {
        "id": uid, "email": email, "phone": phone,
        "password_hash": hash_password(body.password),
        "name": body.name, "role": "customer",
        "city": body.city, "addresses": [],
        "active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(uid, "customer")
    return {"token": token, "user": strip_mongo(doc)}

@api.post("/customer/login")
async def customer_login(body: CustomerLogin):
    user = await db.users.find_one({"phone": body.phone.strip(), "role": "customer"})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid phone or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account disabled")
    token = create_token(user["id"], "customer")
    return {"token": token, "user": strip_mongo(user)}

@api.get("/catalog")
async def get_catalog():
    """Public service catalogue — no auth required."""
    return {"categories": CATALOG}

@api.get("/catalog/service/{sku}")
async def get_service(sku: str):
    s = SKU_INDEX.get(sku)
    if not s:
        raise HTTPException(404, "Service not found")
    # Find parent category
    for cat in CATALOG:
        if any(svc["sku"] == sku for svc in cat["services"]):
            return {"service": s, "category": {"sku": cat["sku"], "name": cat["name"], "icon": cat["icon"]}}
    return {"service": s, "category": None}

@api.post("/customer/addresses")
async def add_address(body: AddressIn, user: dict = Depends(require_roles("customer"))):
    addr = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_iso()}
    await db.users.update_one({"id": user["id"]}, {"$push": {"addresses": addr}})
    return addr

@api.get("/customer/addresses")
async def list_addresses(user: dict = Depends(require_roles("customer"))):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return u.get("addresses", []) if u else []

@api.post("/customer/bookings")
async def create_booking(body: BookingCreate, user: dict = Depends(require_roles("customer"))):
    svc = SKU_INDEX.get(body.service_sku)
    if not svc:
        raise HTTPException(404, "Service not found")
    # Resolve address
    addr = None
    if body.address_id:
        u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        addr = next((a for a in (u.get("addresses") or []) if a["id"] == body.address_id), None)
    elif body.address:
        addr = {"id": str(uuid.uuid4()), **body.address.dict()}
        await db.users.update_one({"id": user["id"]}, {"$push": {"addresses": addr}})
    if not addr:
        raise HTTPException(400, "Address required")
    # Find parent category for appliance_type
    appliance = "Other"
    for cat in CATALOG:
        if any(s["sku"] == body.service_sku for s in cat["services"]):
            appliance = cat["name"]; break
    lid = str(uuid.uuid4())
    lead = {
        "id": lid,
        "customer_name": user["name"], "phone": user["phone"],
        "address": f"{addr['line1']}, {addr.get('line2') or ''} {addr['city']}".strip(),
        "city": addr["city"],
        "appliance_type": appliance,
        "issue": f"{svc['name']}: {body.issue_note or '—'} | Slot: {body.slot_date} {body.slot_window}",
        "priority": "medium", "source": "customer_app",
        "status": "new",
        "manager_id": None, "technician_id": None,
        "cost_points": 0,
        "estimated_cost": svc["price"], "final_cost": None,
        "rating": None, "rating_comment": None,
        "notes": [], "attachments": [],
        "customer_id": user["id"],
        "service_sku": body.service_sku, "service_name": svc["name"],
        "slot_date": body.slot_date, "slot_window": body.slot_window,
        "booking_address": addr,
        "created_at": now_iso(),
        "assigned_manager_at": None, "assigned_technician_at": None, "completed_at": None,
    }
    await db.leads.insert_one(lead)
    # Auto-assign to a manager in same city (if any) with sufficient wallet
    settings = await get_settings()
    cost = settings.get("cost_per_lead", 200)
    mgr = await db.users.find_one({"role": "manager", "city": addr["city"], "active": True, "wallet_balance": {"$gte": cost}})
    if mgr:
        try:
            await _wallet_txn(mgr["id"], "debit", cost, f"Customer-app lead: {svc['name']}", lid)
            await db.leads.update_one({"id": lid}, {"$set": {
                "manager_id": mgr["id"], "status": "assigned_manager",
                "cost_points": cost, "assigned_manager_at": now_iso(),
            }})
            await send_notification("whatsapp", mgr.get("phone") or mgr["email"], "lead_assigned_manager",
                {"manager_name": mgr["name"], "appliance": appliance, "customer": user["name"],
                 "city": addr["city"], "cost_points": cost}, user_id=mgr["id"], lead_id=lid)
        except HTTPException:
            pass
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    return lead

@api.get("/customer/bookings")
async def list_my_bookings(user: dict = Depends(require_roles("customer"))):
    items = await db.leads.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich with technician info if assigned
    out = []
    for b in items:
        if b.get("technician_id"):
            t = await db.users.find_one({"id": b["technician_id"]}, {"_id": 0, "password_hash": 0})
            if t:
                b["technician"] = {"id": t["id"], "name": t["name"], "phone": t.get("phone"),
                                   "rating": t.get("rating"), "jobs_completed": t.get("jobs_completed"),
                                   "location": t.get("location")}
        out.append(b)
    return out

@api.get("/customer/bookings/{bid}")
async def get_my_booking(bid: str, user: dict = Depends(require_roles("customer"))):
    b = await db.leads.find_one({"id": bid, "customer_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("technician_id"):
        t = await db.users.find_one({"id": b["technician_id"]}, {"_id": 0, "password_hash": 0})
        if t:
            b["technician"] = {"id": t["id"], "name": t["name"], "phone": t.get("phone"),
                               "rating": t.get("rating"), "jobs_completed": t.get("jobs_completed"),
                               "location": t.get("location")}
    return b

class BookingCancelIn(BaseModel):
    reason: Optional[str] = None

@api.post("/customer/bookings/{bid}/cancel")
async def cancel_my_booking(bid: str, body: BookingCancelIn, user: dict = Depends(require_roles("customer"))):
    b = await db.leads.find_one({"id": bid, "customer_id": user["id"]})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["status"] in ("completed", "cancelled"):
        raise HTTPException(400, f"Already {b['status']}")
    await db.leads.update_one({"id": bid}, {"$set": {"status": "cancelled"}, "$push": {"notes": {
        "id": str(uuid.uuid4()), "by": user["id"], "by_name": user["name"],
        "text": f"Customer cancelled: {body.reason or 'no reason'}", "at": now_iso(),
    }}})
    # 80% refund to manager if previously assigned
    if b.get("manager_id") and b.get("cost_points"):
        refund = int(b["cost_points"] * 0.8)
        if refund > 0:
            await _wallet_txn(b["manager_id"], "refund", refund, f"Customer cancelled: {b.get('customer_name')}", bid)
    return await db.leads.find_one({"id": bid}, {"_id": 0})

class BookingRateIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = None

@api.post("/customer/bookings/{bid}/rate")
async def rate_my_booking(bid: str, body: BookingRateIn, user: dict = Depends(require_roles("customer"))):
    b = await db.leads.find_one({"id": bid, "customer_id": user["id"]})
    if not b:
        raise HTTPException(404, "Booking not found")
    await db.leads.update_one({"id": bid}, {"$set": {"rating": body.stars, "rating_comment": body.comment}})
    if b.get("technician_id"):
        pipeline = [
            {"$match": {"technician_id": b["technician_id"], "rating": {"$ne": None}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
        ]
        res = await db.leads.aggregate(pipeline).to_list(1)
        if res:
            await db.users.update_one({"id": b["technician_id"]}, {"$set": {"rating": round(res[0]["avg"], 2)}})
    return await db.leads.find_one({"id": bid}, {"_id": 0})

# -----------------------------------------------------------------------------
# Seeding
# -----------------------------------------------------------------------------
async def seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.leads.create_index("status")
    await db.leads.create_index("manager_id")
    await db.leads.create_index("technician_id")
    await db.transactions.create_index("manager_id")

    # Settings
    await get_settings()

    # Super admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Super Admin",
            "role": "super_admin",
            "phone": "+91-9905231750",
            "city": "Delhi",
            "active": True,
            "created_at": now_iso(),
        })
        log.info("Seeded super admin %s", ADMIN_EMAIL)
    elif not verify_password(ADMIN_PASSWORD, admin.get("password_hash", "")):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Demo managers
    demo_managers = [
        {"email": "rahul.manager@gorepair.in", "name": "Rahul Sharma", "city": "Delhi", "phone": "+91-9111111111"},
        {"email": "priya.manager@gorepair.in", "name": "Priya Iyer", "city": "Mumbai", "phone": "+91-9222222222"},
    ]
    for m in demo_managers:
        if not await db.users.find_one({"email": m["email"]}):
            mid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": mid,
                "email": m["email"],
                "password_hash": hash_password("manager123"),
                "name": m["name"],
                "role": "manager",
                "phone": m["phone"],
                "city": m["city"],
                "wallet_balance": 2000,  # seed with balance
                "has_brand_kit": False,
                "active": True,
                "created_at": now_iso(),
            })
            # seed recharge txn
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "manager_id": mid,
                "type": "credit",
                "points": 2000,
                "delta": 2000,
                "balance_after": 2000,
                "reason": "Welcome bonus (seed)",
                "lead_id": None,
                "created_at": now_iso(),
            })

    mgrs = await db.users.find({"role": "manager"}).to_list(10)
    mgr_by_city = {m["city"]: m for m in mgrs}

    # Demo technicians
    demo_techs = [
        {"email": "amit.tech@gorepair.in", "name": "Amit Kumar", "city": "Delhi", "skills": ["AC", "Washing Machine"]},
        {"email": "suresh.tech@gorepair.in", "name": "Suresh Patel", "city": "Delhi", "skills": ["Fridge", "Microwave"]},
        {"email": "ravi.tech@gorepair.in", "name": "Ravi Verma", "city": "Mumbai", "skills": ["TV", "AC", "Washing Machine"]},
    ]
    for t in demo_techs:
        if not await db.users.find_one({"email": t["email"]}):
            mgr = mgr_by_city.get(t["city"]) or mgrs[0]
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": t["email"],
                "password_hash": hash_password("tech123"),
                "name": t["name"],
                "role": "technician",
                "phone": "+91-9333333333",
                "city": t["city"],
                "skills": t["skills"],
                "manager_id": mgr["id"],
                "rating": 4.5,
                "jobs_completed": 0,
                "active": True,
                "created_at": now_iso(),
            })

    # Demo leads
    if await db.leads.count_documents({}) == 0:
        demo_leads = [
            {"customer_name": "Neha Gupta", "phone": "9876500001", "address": "B-12 Lajpat Nagar", "city": "Delhi",
             "appliance_type": "AC", "issue": "Not cooling, making noise", "priority": "high", "source": "facebook"},
            {"customer_name": "Rohit Mehta", "phone": "9876500002", "address": "Andheri West", "city": "Mumbai",
             "appliance_type": "Washing Machine", "issue": "Drum not rotating", "priority": "medium", "source": "google"},
            {"customer_name": "Anjali Rao", "phone": "9876500003", "address": "Dwarka Sec-10", "city": "Delhi",
             "appliance_type": "Fridge", "issue": "Freezer ice build-up", "priority": "low", "source": "website"},
            {"customer_name": "Kiran Joshi", "phone": "9876500004", "address": "Bandra East", "city": "Mumbai",
             "appliance_type": "TV", "issue": "Screen flickering", "priority": "medium", "source": "whatsapp"},
            {"customer_name": "Vikram Desai", "phone": "9876500005", "address": "Saket", "city": "Delhi",
             "appliance_type": "Microwave", "issue": "Not heating", "priority": "low", "source": "manual"},
        ]
        for ld in demo_leads:
            await db.leads.insert_one({
                "id": str(uuid.uuid4()),
                **ld,
                "status": "new",
                "manager_id": None, "technician_id": None,
                "cost_points": 0, "estimated_cost": None, "final_cost": None,
                "rating": None, "rating_comment": None,
                "notes": [], "attachments": [],
                "created_at": now_iso(),
                "assigned_manager_at": None, "assigned_technician_at": None, "completed_at": None,
            })

    # Ensure at least one COMPLETED demo lead exists so the Invoice button is visible immediately.
    if await db.leads.count_documents({"status": "completed", "final_cost": {"$ne": None}}) == 0:
        delhi_mgr = next((m for m in mgrs if m.get("city") == "Delhi"), mgrs[0] if mgrs else None)
        delhi_tech = await db.users.find_one({"role": "technician", "city": "Delhi"})
        if delhi_mgr and delhi_tech:
            now = now_iso()
            completed_lead = {
                "id": str(uuid.uuid4()),
                "customer_name": "Pooja Bansal", "phone": "9876500099",
                "address": "C-44 Greater Kailash 2", "city": "Delhi",
                "appliance_type": "AC", "issue": "Compressor replacement and gas refill",
                "priority": "high", "source": "google",
                "status": "completed",
                "manager_id": delhi_mgr["id"],
                "technician_id": delhi_tech["id"],
                "cost_points": 200,
                "estimated_cost": 3000.0, "final_cost": 3500.0,
                "rating": 5, "rating_comment": "Quick and professional service.",
                "notes": [
                    {"id": str(uuid.uuid4()), "by": delhi_tech["id"], "by_name": delhi_tech["name"],
                     "text": "Replaced compressor and refilled gas. Cooling now normal.", "at": now},
                ],
                "attachments": [],
                "created_at": now,
                "assigned_manager_at": now,
                "assigned_technician_at": now,
                "completed_at": now,
            }
            await db.leads.insert_one(completed_lead)
            # bump tech jobs_completed
            await db.users.update_one({"id": delhi_tech["id"]}, {"$inc": {"jobs_completed": 1}})

app.include_router(api)
# Uploads must be under /api prefix so Kubernetes ingress routes them to the backend.
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.on_event("startup")
async def on_startup():
    await seed()
    log.info("GO Repair CRM ready")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
