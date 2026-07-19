"""Auth dependencies — require_user / require_admin (cho router T1-2+ dùng).

Đọc JWT từ cookie (CONTRACT §1: EventSource không set header → cookie), decode → claims.
Thiếu/hỏng token → 401 envelope 4-field. Sai role → 403.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from app.auth.permissions import DEFAULT_ROLE_PERMISSIONS, DEFAULT_TENANT_ID, load_principal
from app.auth.security import decode_token
from app.config import AUTH_COOKIE, DEV_ADMIN_CLAIMS, DEV_SKIP_AUTH
from app.errors import ApiError

log = logging.getLogger("auth")

# cache admin sub uuid (query DB 1 lần khi DEV_SKIP_AUTH ON — không query mỗi request)
_dev_admin_sub: str | None = None


def _dev_admin_claims() -> dict[str, Any]:
    """Claims admin cho DEV_SKIP_AUTH (D-39). Lazy-load sub uuid từ DB 1 lần."""
    global _dev_admin_sub
    if _dev_admin_sub is None:
        try:
            import psycopg2

            from app.db.config import DATABASE_URL

            conn = psycopg2.connect(DATABASE_URL)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM users WHERE username='admin' LIMIT 1")
                    row = cur.fetchone()
                    _dev_admin_sub = str(row[0]) if row else "dev-admin"
            finally:
                conn.close()
        except Exception:  # noqa: BLE001 — DB chưa sẵn lúc dev boot không được chặn skip-auth
            _dev_admin_sub = "dev-admin"
    return {**DEV_ADMIN_CLAIMS, "sub": _dev_admin_sub}


def _claims_from_request(request: Request) -> dict[str, Any]:
    # DEV_SKIP_AUTH (D-39): flag ON → admin THẲNG, bỏ cookie/JWT. Skip thắng cả khi có cookie thật
    # (dev tiện — defensive case). 1 CHỖ duy nhất (không rải if-flag khắp routes).
    if DEV_SKIP_AUTH:
        claims = _dev_admin_claims()
    else:
        token = request.cookies.get(AUTH_COOKIE)
        # fallback: Bearer header (REST client/test tiện) — EventSource vẫn dùng cookie
        if not token:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth[7:]
        claims = decode_token(token) if token else None
    if claims is None:
        raise ApiError(
            status_code=401,
            code="unauthorized",
            message="Chưa đăng nhập hoặc phiên hết hạn.",
            hint="Đăng nhập lại qua POST /api/auth/login.",
            retryable=False,
        )
    try:
        principal = load_principal(str(claims.get("sub") or ""))
    except Exception:  # noqa: BLE001 — bypass dev phải boot được khi PostgreSQL chưa sẵn
        if not DEV_SKIP_AUTH:
            raise
        log.warning("DEV_SKIP_AUTH: không tải được principal từ DB; dùng admin Miền Bắc cố định")
        principal = None
    if principal is None and DEV_SKIP_AUTH:
        # DB may be unavailable during local boot; keep the bypass explicitly tenant-bound.
        principal = {
            **claims,
            "owner_id": None,
            "tenant_id": DEFAULT_TENANT_ID,
            "tenant": DEFAULT_TENANT_ID,
            "region": "north",
            "tenant_name": "SHB Bán lẻ · Miền Bắc",
            "display_name": "Quản lý demo",
            "name": "Quản lý demo",
            "active": True,
            "is_active": True,
            "permissions": list(DEFAULT_ROLE_PERMISSIONS["admin"]),
        }
    if principal is None:
        raise ApiError(
            status_code=401,
            code="unauthorized",
            message="Tài khoản không tồn tại, đã bị khóa hoặc tenant ngừng hoạt động.",
            hint="Đăng nhập lại hoặc liên hệ quản trị tenant.",
            retryable=False,
        )
    return {**claims, **principal}


def require_user(request: Request) -> dict[str, Any]:
    """Bất kỳ account đã đăng nhập (user hoặc admin)."""
    return _claims_from_request(request)


def require_admin(request: Request) -> dict[str, Any]:
    """Compatibility dependency: tenant admin with case-approval permission."""
    claims = _claims_from_request(request)
    if "cases.approve" not in set(claims.get("permissions") or []):
        raise ApiError(
            status_code=403,
            code="forbidden",
            message="Chỉ quản lý (admin) được thao tác này.",
            hint="Đăng nhập bằng account admin.",
            retryable=False,
        )
    return claims


def can_access_conv(conv: dict[str, Any], claims: dict[str, Any]) -> bool:
    """Tenant is mandatory; legacy customer accounts remain owner-only."""
    if not claims.get("tenant_id") or conv.get("tenant_id") != claims.get("tenant_id"):
        return False
    return claims.get("role") != "customer" or conv.get("user_id") == claims.get("username")
