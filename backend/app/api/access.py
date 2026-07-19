"""Tenant-local user and role-permission administration."""

from __future__ import annotations

import secrets
from typing import Any, Literal

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.auth.permissions import (
    require_permission,
    validated_permissions,
    validated_role_permissions,
)
from app.auth.security import hash_password
from app.db.config import DATABASE_URL
from app.errors import ApiError

router = APIRouter(prefix="/api/access", tags=["access"])
ROLE_LABELS = {
    "user": "Nhân viên tín dụng",
    "admin": "Giám đốc chi nhánh",
}


class CreateUserBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=100)
    display_name: str = Field(min_length=1, max_length=200)
    role: Literal["user"] = "user"

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not 3 <= len(normalized) <= 64 or any(
            char not in "abcdefghijklmnopqrstuvwxyz0123456789._-" for char in normalized
        ):
            raise ValueError(
                "username must be 3-64 lowercase ASCII letters, digits, dot, underscore or hyphen"
            )
        return normalized

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("display_name must contain at least 2 characters")
        return normalized


class UpdateUserBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active: bool | None = None
    is_active: bool | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("display_name must contain at least 2 characters")
        return normalized


class UpdateRoleBody(BaseModel):
    permissions: list[str]


def _user_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "display_name": row["display_name"],
        "name": row["display_name"],
        "role": row["role"],
        "active": row["is_active"],
        "is_active": row["is_active"],
        "activation_required": row["activation_required"],
        "tenant_id": row["tenant_id"],
        "tenant": row["tenant_id"],
        "tenant_name": row["tenant_name"],
        "region": row["region"],
    }


def _require_manager(principal: dict[str, Any]) -> None:
    """Defense in depth: access administration cannot be delegated to employee role."""
    if principal.get("role") != "admin":
        raise ApiError(
            403,
            "manager_only",
            "Khu vực quản trị người dùng chỉ dành cho Quản lý.",
            "Liên hệ quản lý đơn vị nếu cần thay đổi quyền truy cập.",
            retryable=False,
        )


@router.get("/users")
def list_users(
    principal: dict = Depends(require_permission("users.read")),
) -> list[dict[str, Any]]:
    _require_manager(principal)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT u.id, u.username, u.display_name, u.role, u.is_active, "
                "u.activation_required, u.tenant_id, "
                "t.region, t.display_name AS tenant_name "
                "FROM users u JOIN tenants t ON t.id=u.tenant_id "
                "WHERE u.tenant_id=%s AND u.role IN ('user','admin') ORDER BY u.username",
                (principal["tenant_id"],),
            )
            return [_user_dict(dict(row)) for row in cur.fetchall()]
    finally:
        conn.close()


@router.post("/users", status_code=201)
def create_user(
    body: CreateUserBody,
    principal: dict = Depends(require_permission("users.create")),
) -> dict[str, Any]:
    _require_manager(principal)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO users "
                "(username, pass_hash, role, owner_id, tenant_id, display_name, is_active, "
                "activation_required) "
                "VALUES (%s,%s,%s,NULL,%s,%s,false,true) "
                "RETURNING id, username, display_name, role, is_active, activation_required, "
                "tenant_id",
                (
                    body.username,
                    hash_password(secrets.token_urlsafe(48)),
                    body.role,
                    principal["tenant_id"],
                    body.display_name,
                ),
            )
            row = cur.fetchone()
            row = {
                **dict(row),
                "region": principal["region"],
                "tenant_name": principal["tenant_name"],
            }
        conn.commit()
        return {**_user_dict(row), "activation_required": True}
    except psycopg2.errors.UniqueViolation as exc:
        conn.rollback()
        raise ApiError(
            409,
            "username_exists",
            "Tên đăng nhập đã tồn tại.",
            "Chọn tên đăng nhập khác.",
            retryable=False,
        ) from exc
    finally:
        conn.close()


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UpdateUserBody,
    principal: dict = Depends(require_permission("users.manage")),
) -> dict[str, Any]:
    _require_manager(principal)
    if body.active is not None and body.is_active is not None and body.active != body.is_active:
        raise ApiError(
            400,
            "conflicting_active",
            "Trạng thái hoạt động không nhất quán.",
            "Chỉ gửi một giá trị active.",
            retryable=False,
        )
    requested_active = body.active if body.active is not None else body.is_active
    if user_id == principal["sub"] and requested_active is False:
        raise ApiError(
            400,
            "self_disable_forbidden",
            "Không thể tự khóa tài khoản đang sử dụng.",
            "Nhờ quản lý khác thực hiện.",
            retryable=False,
        )

    updates: list[str] = []
    values: list[Any] = []
    if requested_active is not None:
        updates.append("is_active=%s")
        values.append(requested_active)
    if body.display_name is not None:
        updates.append("display_name=%s")
        values.append(body.display_name)
    if not updates:
        raise ApiError(
            400,
            "empty_update",
            "Không có trường nào để cập nhật.",
            "Truyền active hoặc display_name.",
            retryable=False,
        )

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT u.id, u.username, u.display_name, u.role, u.is_active, "
                "u.activation_required, u.tenant_id "
                "FROM users u WHERE u.id::text=%s AND u.tenant_id=%s "
                "AND u.role IN ('user','admin') FOR UPDATE",
                (user_id, principal["tenant_id"]),
            )
            target = cur.fetchone()
            if target is None:
                raise ApiError(
                    404,
                    "not_found",
                    "Không có người dùng trong đơn vị hiện tại.",
                    "Làm mới danh sách và thử lại.",
                    retryable=False,
                )
            if user_id == principal["sub"] and requested_active is False:
                raise ApiError(
                    400,
                    "self_disable_forbidden",
                    "Không thể tự khóa tài khoản đang sử dụng.",
                    "Nhờ quản lý khác thực hiện.",
                    retryable=False,
                )
            if target["activation_required"] and requested_active is True:
                raise ApiError(
                    409,
                    "activation_pending",
                    "Tài khoản đang chờ hoàn tất quy trình kích hoạt.",
                    "Hoàn tất quy trình cấp thông tin đăng nhập trước khi kích hoạt.",
                    retryable=False,
                )
            if (
                target["role"] == "admin"
                and target["is_active"]
                and requested_active is False
            ):
                cur.execute(
                    "SELECT count(*) FROM users WHERE tenant_id=%s AND role='admin' "
                    "AND is_active=true AND activation_required=false",
                    (principal["tenant_id"],),
                )
                if int(cur.fetchone()["count"]) <= 1:
                    raise ApiError(
                        409,
                        "last_manager",
                        "Đơn vị phải còn ít nhất một tài khoản Quản lý đang hoạt động.",
                        "Cấp một tài khoản Quản lý khác trước khi vô hiệu hóa tài khoản này.",
                        retryable=False,
                    )

            values.extend([user_id, principal["tenant_id"]])
            cur.execute(
                f"UPDATE users u SET {', '.join(updates)} "
                "WHERE u.id::text=%s AND u.tenant_id=%s AND u.role IN ('user','admin') "
                "RETURNING u.id, u.username, u.display_name, u.role, u.is_active, "
                "u.activation_required, u.tenant_id",
                tuple(values),
            )
            row = cur.fetchone()
            row = {
                **dict(row),
                "region": principal["region"],
                "tenant_name": principal["tenant_name"],
            }
        conn.commit()
        return _user_dict(row)
    finally:
        conn.close()


@router.get("/roles")
def list_roles(
    principal: dict = Depends(require_permission("roles.read")),
) -> list[dict[str, Any]]:
    _require_manager(principal)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT role, permissions FROM tenant_role_permissions "
                "WHERE tenant_id=%s AND role IN ('user','admin') ORDER BY role",
                (principal["tenant_id"],),
            )
            return [
                {
                    "tenant_id": principal["tenant_id"],
                    "region": principal["region"],
                    "role": row["role"],
                    "label": ROLE_LABELS[row["role"]],
                    "permissions": validated_permissions(row["permissions"] or []),
                }
                for row in cur.fetchall()
            ]
    finally:
        conn.close()


@router.put("/roles/{role}")
def update_role(
    role: str,
    body: UpdateRoleBody,
    principal: dict = Depends(require_permission("roles.manage")),
) -> dict[str, Any]:
    _require_manager(principal)
    if role not in {"user", "admin"}:
        raise ApiError(
            400,
            "bad_role",
            f"Role '{role}' không được phép.",
            "Chỉ hỗ trợ vai trò Nhân viên tín dụng và Quản lý.",
            retryable=False,
        )
    if role == "admin":
        raise ApiError(
            403,
            "protected_role",
            "Quyền của Giám đốc chi nhánh là cấu hình bảo vệ và không thể chỉnh sửa.",
            "Chỉ điều chỉnh quyền của Nhân viên tín dụng.",
            retryable=False,
        )
    try:
        permissions = validated_role_permissions(role, body.permissions)
    except ValueError as exc:
        raise ApiError(
            400,
            "bad_permission",
            "Bảng quyền chưa hợp lệ.",
            "Giữ các quyền nền bắt buộc và không gán quyền quản trị hệ thống cho Nhân viên tín dụng.",
            retryable=False,
        ) from exc

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "UPDATE tenant_role_permissions SET permissions=%s "
                "WHERE tenant_id=%s AND role=%s RETURNING tenant_id, role, permissions",
                (psycopg2.extras.Json(permissions), principal["tenant_id"], role),
            )
            row = cur.fetchone()
        conn.commit()
        if row is None:
            raise ApiError(
                404,
                "not_found",
                "Role không tồn tại trong tenant hiện tại.",
                "Seed lại role matrix cho tenant.",
                retryable=False,
            )
        return {
            "tenant_id": row["tenant_id"],
            "region": principal["region"],
            "role": row["role"],
            "label": ROLE_LABELS[row["role"]],
            "permissions": validated_permissions(row["permissions"] or []),
        }
    finally:
        conn.close()
