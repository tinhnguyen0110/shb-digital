"""Auth router — POST /api/auth/login (CONTRACT §1).

Router = tầng HTTP: nhận body, gọi service, set cookie JWT, trả resource trần / 401 envelope.
KHÔNG chứa business (service lo) — router chỉ dịch HTTP↔service.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.auth.deps import require_user
from app.auth.service import authenticate
from app.config import AUTH_COOKIE, AUTH_COOKIE_SECURE, JWT_TTL_SECONDS
from app.errors import ApiError

router = APIRouter(prefix="/api/auth", tags=["auth"])
# D-56: /api/me (Export FE T8-2) — router riêng prefix /api (không /api/auth). /api/auth/me GIỮ (FE cũ).
me_router = APIRouter(prefix="/api", tags=["me"])


class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginBody, response: Response) -> dict:
    """{username, password} → {token, user:{username, role}} (CONTRACT §1).
    JWT cũng set vào cookie httponly (EventSource dùng cookie — không set header được)."""
    result = authenticate(body.username, body.password)
    if result is None:
        raise ApiError(
            status_code=401,
            code="unauthorized",
            message="Sai tên đăng nhập hoặc mật khẩu.",
            hint="Kiểm lại thông tin đăng nhập. Tài khoản demo nội bộ: staff / admin.",
            retryable=True,
        )
    response.set_cookie(
        key=AUTH_COOKIE,
        value=result["token"],
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="lax",
        max_age=JWT_TTL_SECONDS,
    )
    # Success = resource trần (CONTRACT §0) — trả token (FE dùng nếu cần) + user
    return result


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    """Xóa cookie phiên một cách idempotent; endpoint không yêu cầu phiên còn hợp lệ."""
    response.delete_cookie(
        key=AUTH_COOKIE,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="lax",
    )


def _me_payload(claims: dict) -> dict:
    """D-56: {username, role, owner_id} phẳng (Export FE T8-2) + `user` wrap (FE boot-check cũ, không
    phá). owner_id của REQUESTER (JOIN users by claims.sub). DEV_SKIP_AUTH → admin owner_id=None."""
    owner_id = claims.get("owner_id")
    username, role = claims.get("username"), claims.get("role")
    profile = {
        "username": username,
        "role": role,
        "owner_id": owner_id,
        "tenant_id": claims.get("tenant_id"),
        "tenant": claims.get("tenant_id"),
        "region": claims.get("region"),
        "tenant_name": claims.get("tenant_name"),
        "display_name": claims.get("display_name"),
        "name": claims.get("display_name"),
        "active": claims.get("active", True),
        "is_active": claims.get("is_active", True),
        "permissions": claims.get("permissions") or [],
    }
    return {**profile, "user": profile}


@router.get("/me")
def me_auth(claims: dict = Depends(require_user)) -> dict:
    """/api/auth/me — FE boot-check cũ. Giữ backward + thêm owner_id (D-56)."""
    return _me_payload(claims)


@me_router.get("/me")
def me(claims: dict = Depends(require_user)) -> dict:
    """/api/me (D-56 Export FE T8-2) — {username, role, owner_id}. Cùng payload /api/auth/me."""
    return _me_payload(claims)


def _owner_id_of(user_id: str | None) -> str | None:
    """owner_id của account (JOIN users by id). None = account ngân hàng (admin/user) hoặc không tồn tại."""
    if not user_id:
        return None
    import psycopg2

    from app.db.config import DATABASE_URL

    try:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT owner_id FROM users WHERE id::text=%s", (user_id,))
                row = cur.fetchone()
                return row[0] if row else None
        finally:
            conn.close()
    except psycopg2.Error:
        return None
