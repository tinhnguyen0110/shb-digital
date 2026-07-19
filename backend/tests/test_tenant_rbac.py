"""Focused tenant/RBAC tests; core authorization cases run without PostgreSQL."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.access import (
    CreateUserBody,
    UpdateRoleBody,
    UpdateUserBody,
    create_user,
    update_role,
    update_user,
)
from app.auth import deps
from app.auth.deps import can_access_conv
from app.auth.permissions import (
    ALL_PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    has_permission,
    require_permission,
    validated_permissions,
    validated_role_permissions,
)
from app.auth.security import decode_token, make_token
from app.db.seed_users import SEED_ACCOUNT_PROFILES
from app.errors import ApiError
from app.main import app
from app.orch import store_approvals, store_audit


def test_default_feature_matrix_is_least_privilege():
    employee = set(DEFAULT_ROLE_PERMISSIONS["user"])
    admin = set(DEFAULT_ROLE_PERMISSIONS["admin"])

    assert {"cases.read", "cases.create", "cases.review", "policies.read"} <= employee
    assert "cases.approve" not in employee
    assert "users.manage" not in employee
    assert "monitoring.read" not in employee

    assert employee < admin
    assert {
        "cases.approve",
        "policies.manage",
        "monitoring.read",
        "users.create",
        "users.manage",
        "roles.manage",
    } <= admin
    assert admin == ALL_PERMISSIONS


def test_permission_validation_is_stable_and_rejects_unknown_values():
    assert validated_permissions(["cases.read", "cases.read", "policies.read"]) == [
        "cases.read",
        "policies.read",
    ]
    with pytest.raises(ValueError, match="unknown permissions"):
        validated_permissions(["cases.read", "tenant.escape"])


def test_employee_matrix_rejects_admin_only_permissions_and_broken_dependencies():
    with pytest.raises(ValueError, match="protected"):
        validated_role_permissions("user", ["cases.read", "users.manage"])
    with pytest.raises(ValueError, match="requires"):
        validated_role_permissions("user", ["cases.review"])

    assert validated_role_permissions(
        "user",
        ["cases.read", "cases.create", "cases.review", "products.read", "policies.read"],
    ) == [
        "cases.create",
        "cases.read",
        "cases.review",
        "policies.read",
        "products.read",
    ]


def test_conversation_scope_never_crosses_tenant():
    north = {"tenant_id": "shb-north", "username": "staff", "role": "user"}
    north_admin = {"tenant_id": "shb-north", "username": "admin", "role": "admin"}
    north_customer = {"tenant_id": "shb-north", "username": "c001", "role": "customer"}

    assert can_access_conv({"tenant_id": "shb-north", "user_id": "someone"}, north)
    assert can_access_conv({"tenant_id": "shb-central", "user_id": "staff"}, north) is False
    assert can_access_conv({"tenant_id": "shb-central", "user_id": "admin"}, north_admin) is False
    assert can_access_conv({"tenant_id": "shb-north", "user_id": "c001"}, north_customer)
    assert can_access_conv({"tenant_id": "shb-north", "user_id": "c019"}, north_customer) is False


def test_permission_dependency_uses_effective_matrix(monkeypatch):
    principal = {
        "tenant_id": "shb-north",
        "role": "user",
        "permissions": list(DEFAULT_ROLE_PERMISSIONS["user"]),
    }
    monkeypatch.setattr("app.auth.deps.require_user", lambda _request: principal)

    assert require_permission("cases.read")(object()) is principal
    with pytest.raises(ApiError) as exc:
        require_permission("users.manage")(object())
    assert exc.value.status_code == 403
    assert "users.manage" not in exc.value.detail["hint"]
    assert "tenant" not in exc.value.detail["hint"].lower()


def test_has_permission_fails_closed_when_matrix_missing():
    assert has_permission({}, "cases.read") is False
    assert has_permission({"permissions": []}, "cases.read") is False


def test_jwt_carries_additive_tenant_hints():
    token = make_token(
        user_id="user-1",
        username="staff",
        role="user",
        tenant_id="shb-north",
        region="north",
    )
    claims = decode_token(token)
    assert claims is not None
    assert claims["tenant_id"] == "shb-north"
    assert claims["region"] == "north"


def test_demo_accounts_cover_all_regional_tenants():
    profiles = SEED_ACCOUNT_PROFILES
    assert profiles["staff"][0] == profiles["admin"][0] == "shb-north"
    assert profiles["staff_central"][0] == profiles["admin_central"][0] == "shb-central"
    assert profiles["staff_south"][0] == profiles["admin_south"][0] == "shb-south"


def test_access_admin_cannot_disable_self_and_role_changes_are_not_accepted():
    principal = {
        "sub": "admin-id",
        "tenant_id": "shb-north",
        "role": "admin",
        "permissions": list(DEFAULT_ROLE_PERMISSIONS["admin"]),
    }
    with pytest.raises(ApiError) as disabled:
        update_user("admin-id", UpdateUserBody(active=False), principal)
    assert disabled.value.status_code == 400
    assert disabled.value.detail["code"] == "self_disable_forbidden"

    with pytest.raises(ValidationError):
        UpdateUserBody(role="user")


def test_create_user_contract_accepts_no_password_and_rejects_supplied_secret():
    body = CreateUserBody(username="new_officer", display_name="Cán bộ mới", role="user")
    assert body.username == "new_officer"
    assert "password" not in body.model_dump()

    with pytest.raises(ValidationError):
        CreateUserBody(
            username="new_officer",
            display_name="Cán bộ mới",
            role="user",
            password="must-not-be-accepted",
        )
    with pytest.raises(ValidationError):
        CreateUserBody(username="new_manager", display_name="Quản lý mới", role="admin")


def test_create_user_is_inactive_tenant_bound_and_never_returns_generated_secret(monkeypatch):
    captured: dict = {}

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, query, values):
            captured["query"] = query
            captured["values"] = values

        def fetchone(self):
            return {
                "id": "new-user-id",
                "username": "new_officer",
                "display_name": "Cán bộ mới",
                "role": "user",
                "is_active": False,
                "activation_required": True,
                "tenant_id": "shb-central",
            }

    class Connection:
        def cursor(self, **_kwargs):
            return Cursor()

        def commit(self):
            captured["committed"] = True

        def rollback(self):
            captured["rolled_back"] = True

        def close(self):
            captured["closed"] = True

    generated: list[str] = []
    monkeypatch.setattr("app.api.access.psycopg2.connect", lambda _url: Connection())
    monkeypatch.setattr(
        "app.api.access.hash_password",
        lambda secret: generated.append(secret) or "generated-secret-hash",
    )
    principal = {
        "role": "admin",
        "tenant_id": "shb-central",
        "tenant_name": "SHB Bán lẻ · Miền Trung",
        "region": "central",
    }

    result = create_user(
        CreateUserBody(username="new_officer", display_name="Cán bộ mới", role="user"),
        principal,
    )

    assert generated and len(generated[0]) >= 48
    assert generated[0] not in result.values()
    assert captured["values"][3] == "shb-central"
    assert "false,true" in captured["query"]
    assert result["active"] is False
    assert result["is_active"] is False
    assert result["activation_required"] is True
    assert result["tenant_name"] == "SHB Bán lẻ · Miền Trung"


def test_pending_invitation_cannot_be_activated_and_last_manager_cannot_be_disabled(
    monkeypatch,
):
    principal = {
        "sub": "current-admin",
        "role": "admin",
        "tenant_id": "shb-central",
        "tenant_name": "SHB Bán lẻ · Miền Trung",
        "region": "central",
    }

    class Cursor:
        def __init__(self, rows):
            self.rows = iter(rows)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, _query, _values):
            return None

        def fetchone(self):
            return next(self.rows)

    class Connection:
        def __init__(self, rows):
            self.rows = rows

        def cursor(self, **_kwargs):
            return Cursor(self.rows)

        def commit(self):
            return None

        def close(self):
            return None

    pending = {
        "id": "pending-id",
        "username": "pending",
        "display_name": "Nhân viên chờ kích hoạt",
        "role": "user",
        "is_active": False,
        "activation_required": True,
        "tenant_id": "shb-central",
    }
    monkeypatch.setattr(
        "app.api.access.psycopg2.connect",
        lambda _url: Connection([pending]),
    )
    with pytest.raises(ApiError) as activation:
        update_user("pending-id", UpdateUserBody(active=True), principal)
    assert activation.value.status_code == 409
    assert activation.value.detail["code"] == "activation_pending"

    last_manager = {
        **pending,
        "id": "other-admin",
        "username": "other_admin",
        "display_name": "Quản lý còn lại",
        "role": "admin",
        "is_active": True,
        "activation_required": False,
    }
    monkeypatch.setattr(
        "app.api.access.psycopg2.connect",
        lambda _url: Connection([last_manager, {"count": 1}]),
    )
    with pytest.raises(ApiError) as lockout:
        update_user("other-admin", UpdateUserBody(active=False), principal)
    assert lockout.value.status_code == 409
    assert lockout.value.detail["code"] == "last_manager"


def test_admin_permission_matrix_is_protected_without_database():
    principal = {
        "sub": "admin-id",
        "tenant_id": "shb-north",
        "role": "admin",
        "permissions": list(DEFAULT_ROLE_PERMISSIONS["admin"]),
    }
    with pytest.raises(ApiError) as protected:
        update_role("admin", UpdateRoleBody(permissions=["cases.read"]), principal)
    assert protected.value.status_code == 403
    assert protected.value.detail["code"] == "protected_role"


def test_direct_approval_and_audit_queries_include_tenant_guard(monkeypatch):
    approval_sql: dict = {}

    class ApprovalCursor:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, query, values):
            approval_sql["query"] = query
            approval_sql["values"] = values

        def fetchone(self):
            return None

    class ApprovalConnection:
        def cursor(self, **_kwargs):
            return ApprovalCursor()

        def commit(self):
            return None

        def close(self):
            return None

    monkeypatch.setattr(store_approvals.psycopg2, "connect", lambda _url: ApprovalConnection())
    result = store_approvals._decide_sync(
        "00000000-0000-0000-0000-000000000001",
        "approved",
        "admin",
        None,
        tenant_id="shb-north",
    )
    assert result is None
    assert "EXISTS" in approval_sql["query"]
    assert "c.tenant_id=%s" in approval_sql["query"]
    assert approval_sql["values"][-1] == "shb-north"

    audit_sql: dict = {}

    class AuditCursor(ApprovalCursor):
        def execute(self, query, values):
            audit_sql["query"] = query
            audit_sql["values"] = values

        def fetchall(self):
            return []

    class AuditConnection(ApprovalConnection):
        def cursor(self, **_kwargs):
            return AuditCursor()

    monkeypatch.setattr(store_audit.psycopg2, "connect", lambda _url: AuditConnection())
    assert store_audit._query_sync({"conv_id": "foreign-case"}, 20, tenant_id="shb-north") == []
    assert "JOIN conversations c" in audit_sql["query"]
    assert "c.tenant_id = %s" in audit_sql["query"]
    assert audit_sql["values"][-2:] == ("shb-north", 20)


def test_dev_skip_auth_is_explicitly_bound_to_north_when_database_is_down(monkeypatch):
    monkeypatch.setattr(deps, "DEV_SKIP_AUTH", True)
    monkeypatch.setattr(deps, "_dev_admin_sub", "dev-admin")
    monkeypatch.setattr(deps, "load_principal", lambda _sub: (_ for _ in ()).throw(RuntimeError("db down")))

    principal = deps.require_user(object())

    assert principal["tenant_id"] == "shb-north"
    assert principal["region"] == "north"
    assert "users.manage" in principal["permissions"]


def _regional_schema_ready() -> bool:
    from app.db.config import DATABASE_URL

    try:
        import psycopg2

        conn = psycopg2.connect(DATABASE_URL, connect_timeout=2)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT to_regclass('public.tenants'), "
                    "to_regclass('public.tenant_role_permissions'), "
                    "EXISTS (SELECT 1 FROM information_schema.columns "
                    "WHERE table_name='conversations' AND column_name='tenant_id')"
                )
                tenants, matrix, conv_tenant = cur.fetchone()
                return bool(tenants and matrix and conv_tenant)
        finally:
            conn.close()
    except Exception:  # noqa: BLE001 — integration test tự skip khi PG/migration chưa sẵn
        return False


@pytest.mark.skipif(not _regional_schema_ready(), reason="regional tenant migration chưa sẵn trong PostgreSQL test")
def test_regional_login_stamps_case_and_hides_it_from_other_tenant():
    import psycopg2

    from app.db.config import DATABASE_URL

    north = TestClient(app)
    central = TestClient(app)

    north_login = north.post("/api/auth/login", json={"username": "staff", "password": "staff"})
    central_login = central.post(
        "/api/auth/login",
        json={"username": "admin_central", "password": "admin_central"},
    )
    assert north_login.status_code == 200
    assert central_login.status_code == 200
    assert central_login.json()["user"]["tenant_id"] == "shb-central"

    conv_id: str | None = None
    try:
        created = north.post("/api/conversations", json={"title": "tenant-bound integration test"})
        assert created.status_code == 201
        conv = created.json()
        assert conv["tenant_id"] == "shb-north"
        conv_id = conv["id"]

        assert north.get(f"/api/conversations/{conv_id}").status_code == 200
        assert central.get(f"/api/conversations/{conv_id}").status_code == 404
    finally:
        if conv_id is not None:
            conn = psycopg2.connect(DATABASE_URL)
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM conversations WHERE id=%s", (conv_id,))
                conn.commit()
            finally:
                conn.close()
