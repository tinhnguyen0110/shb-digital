"""Tenant-aware feature permissions and authenticated principal loading.

RBAC remains intentionally small: the database stores one permission list per
``(tenant, role)`` while application code owns the finite permission vocabulary.
Tenant identity always comes from the authenticated user row, never request input.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import Request

from app.db.config import DATABASE_URL
from app.errors import ApiError

DEFAULT_TENANT_ID = "shb-north"
INTERNAL_ROLES = frozenset({"user", "admin"})
KNOWN_ROLES = frozenset({*INTERNAL_ROLES, "customer"})

ALL_PERMISSIONS = frozenset(
    {
        "cases.read",
        "cases.create",
        "cases.review",
        "cases.approve",
        "products.read",
        "policies.read",
        "policies.manage",
        "monitoring.read",
        "users.read",
        "users.create",
        "users.manage",
        "roles.read",
        "roles.manage",
    }
)

ADMIN_ONLY_PERMISSIONS = frozenset(
    {
        "users.read",
        "users.create",
        "users.manage",
        "roles.read",
        "roles.manage",
    }
)

PERMISSION_DEPENDENCIES: dict[str, frozenset[str]] = {
    "cases.create": frozenset({"cases.read"}),
    "cases.review": frozenset({"cases.read"}),
    "cases.approve": frozenset({"cases.read", "cases.review"}),
    "policies.manage": frozenset({"policies.read"}),
}

DEFAULT_ROLE_PERMISSIONS: dict[str, tuple[str, ...]] = {
    "user": (
        "cases.read",
        "cases.create",
        "cases.review",
        "products.read",
        "policies.read",
    ),
    "admin": tuple(sorted(ALL_PERMISSIONS)),
    # Compatibility only: the current product no longer presents customer login.
    "customer": ("cases.read", "cases.create", "cases.review"),
}


def validated_permissions(values: Iterable[str]) -> list[str]:
    """Return a stable unique permission list or reject unknown capabilities."""
    permissions = sorted(set(values))
    unknown = set(permissions) - ALL_PERMISSIONS
    if unknown:
        raise ValueError(f"unknown permissions: {sorted(unknown)}")
    return permissions


def validated_role_permissions(role: str, values: Iterable[str]) -> list[str]:
    """Validate a role matrix, including non-delegable and dependency rules."""
    permissions = validated_permissions(values)
    permission_set = set(permissions)
    if role == "user":
        protected = permission_set & ADMIN_ONLY_PERMISSIONS
        if protected:
            raise ValueError("employee role contains protected access-management permissions")
    for permission, requirements in PERMISSION_DEPENDENCIES.items():
        if permission in permission_set:
            missing = requirements - permission_set
            if missing:
                raise ValueError(f"{permission} requires {sorted(missing)}")
    return permissions


def _principal_row(user_id: str) -> dict[str, Any] | None:
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT u.id, u.username, u.role, u.owner_id, u.tenant_id, u.display_name, "
                "u.is_active, u.activation_required, t.region, t.display_name AS tenant_name, "
                "t.is_active AS tenant_active, "
                "COALESCE(rp.permissions, '[]'::jsonb) AS permissions "
                "FROM users u JOIN tenants t ON t.id=u.tenant_id "
                "LEFT JOIN tenant_role_permissions rp ON rp.tenant_id=u.tenant_id AND rp.role=u.role "
                "WHERE u.id::text=%s",
                (user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def load_principal(user_id: str) -> dict[str, Any] | None:
    """Load current authorization state; inactive user/tenant fails closed."""
    row = _principal_row(user_id)
    if (
        not row
        or not row["is_active"]
        or row["activation_required"]
        or not row["tenant_active"]
    ):
        return None
    permissions = validated_permissions(row.get("permissions") or [])
    return {
        "sub": str(row["id"]),
        "username": row["username"],
        "role": row["role"],
        "owner_id": row.get("owner_id"),
        "tenant_id": row["tenant_id"],
        "tenant": row["tenant_id"],
        "region": row["region"],
        "tenant_name": row["tenant_name"],
        "display_name": row["display_name"],
        "name": row["display_name"],
        "active": True,
        "is_active": True,
        "permissions": permissions,
    }


def has_permission(principal: dict[str, Any], permission: str) -> bool:
    return permission in set(principal.get("permissions") or [])


def require_permission(permission: str) -> Callable[[Request], dict[str, Any]]:
    """FastAPI dependency factory for a feature permission."""
    if permission not in ALL_PERMISSIONS:
        raise ValueError(f"unknown permission: {permission}")

    def dependency(request: Request) -> dict[str, Any]:
        from app.auth.deps import require_user

        principal = require_user(request)
        if not has_permission(principal, permission):
            raise ApiError(
                status_code=403,
                code="forbidden",
                message="Bạn không có quyền thực hiện thao tác này.",
                hint="Liên hệ quản lý đơn vị để được cấp quyền phù hợp.",
                retryable=False,
            )
        return principal

    return dependency
