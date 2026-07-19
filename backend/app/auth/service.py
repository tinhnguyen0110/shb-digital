"""Auth service — business logic đăng nhập. KHÔNG biết HTTP (router lo), KHÔNG biết JWT shape
(security.py lo). Query users qua psycopg2 (nhất quán seed_from_lab; S1 chưa cần SQLAlchemy session)."""

from __future__ import annotations

from typing import Any

import psycopg2
import psycopg2.extras

from app.auth.permissions import validated_permissions
from app.auth.security import make_token, verify_password
from app.db.config import DATABASE_URL


def _get_user_by_username(username: str) -> dict[str, Any] | None:
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT u.id, u.username, u.pass_hash, u.role, u.owner_id, u.tenant_id, "
                "u.display_name, u.is_active, u.activation_required, t.region, "
                "t.display_name AS tenant_name, "
                "t.is_active AS tenant_active, COALESCE(rp.permissions, '[]'::jsonb) AS permissions "
                "FROM users u JOIN tenants t ON t.id=u.tenant_id "
                "LEFT JOIN tenant_role_permissions rp ON rp.tenant_id=u.tenant_id AND rp.role=u.role "
                "WHERE u.username=%s",
                (username,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def authenticate(username: str, password: str) -> dict[str, Any] | None:
    """Trả {token, user:{username, role}} khi credential đúng; None khi sai (router → 401).

    So mật khẩu bằng bcrypt (không lộ user-có-tồn-tại-hay-không qua timing khác biệt lớn —
    verify_password vẫn chạy trên hash rỗng nếu user vắng để giảm chênh timing)."""
    user = _get_user_by_username(username)
    stored_hash = user["pass_hash"] if user else ""
    if (
        not verify_password(password, stored_hash)
        or user is None
        or not user["is_active"]
        or user["activation_required"]
        or not user["tenant_active"]
    ):
        return None
    permissions = validated_permissions(user.get("permissions") or [])
    token = make_token(
        user_id=str(user["id"]),
        username=user["username"],
        role=user["role"],
        tenant_id=user["tenant_id"],
        region=user["region"],
    )
    profile = {
        "username": user["username"],
        "role": user["role"],
        "owner_id": user.get("owner_id"),
        "tenant_id": user["tenant_id"],
        "tenant": user["tenant_id"],
        "region": user["region"],
        "tenant_name": user["tenant_name"],
        "display_name": user["display_name"],
        "name": user["display_name"],
        "active": True,
        "is_active": True,
        "permissions": permissions,
    }
    return {"token": token, "user": profile}
