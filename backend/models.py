"""Pydantic models — request/response schemas."""
from datetime import datetime, timezone
from typing import Optional, Literal, Any
from pydantic import BaseModel, EmailStr, Field
import uuid


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ---- Auth
class LoginBody(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["admin", "viewer"]


# ---- Property & Unit
class PropertyIn(BaseModel):
    name: str
    address: str
    type: Literal["residential", "commercial"] = "residential"
    rentec_property_id: Optional[str] = None
    notes: Optional[str] = None


class Property(PropertyIn):
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


class UnitIn(BaseModel):
    property_id: str
    name: str  # e.g. "Suite 200" or "Unit A"
    beds: Optional[int] = None
    baths: Optional[float] = None
    market_rent: Optional[float] = None
    rentec_unit_id: Optional[str] = None
    notes: Optional[str] = None


class Unit(UnitIn):
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)


# ---- Tenant & Lease
class TenantIn(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    property_id: Optional[str] = None
    unit_id: Optional[str] = None
    notes: Optional[str] = None


class Tenant(TenantIn):
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)


class LeaseIn(BaseModel):
    tenant_id: str
    property_id: str
    unit_id: Optional[str] = None
    start_date: str  # YYYY-MM-DD
    end_date: Optional[str] = None
    monthly_rent: float
    deposit: Optional[float] = None
    status: Literal["active", "ended", "pending"] = "active"
    rentec_lease_id: Optional[str] = None


class Lease(LeaseIn):
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)


# ---- Payment (cached/local snapshot of Rentec data)
class PaymentRecord(BaseModel):
    id: str = Field(default_factory=_new_id)
    rentec_payment_id: Optional[str] = None
    lease_id: Optional[str] = None
    tenant_name: Optional[str] = None
    property_address: Optional[str] = None
    amount: float
    date: str  # YYYY-MM-DD
    method: Optional[str] = None
    status: Literal["paid", "partial", "late", "unpaid", "delinquent"] = "paid"
    source: Literal["rentec", "manual"] = "manual"
    created_at: str = Field(default_factory=_now_iso)


# ---- Task
class TaskIn(BaseModel):
    title: str
    description: Optional[str] = None
    property_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["urgent", "normal", "low"] = "normal"
    status: Literal["pending", "in_progress", "done"] = "pending"


class Task(TaskIn):
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)
    completed_at: Optional[str] = None


# ---- Notification settings (per-user toggles)
class NotificationPrefs(BaseModel):
    payment_received: bool = True
    payment_overdue: bool = True


# Generic response wrappers
class OkResponse(BaseModel):
    ok: bool = True
    detail: Optional[str] = None
