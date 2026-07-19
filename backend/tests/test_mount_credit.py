"""Integration test mount_role(credit) — envelope 4-field + ground-truth C001 qua mount.

Gate T1-1 Verification #2 (dscr==3.709) + #3 (bad_param). Handler async → asyncio_mode=auto.
"""

from __future__ import annotations

import asyncio
import json
import threading

from roles.credit.functions import REGISTRY, SCHEMAS

import app.mount.mount_role as mount_module
from app.mount.mount_role import _make_handler, mount_role

from .conftest import requires_db


def _payload(envelope: dict) -> dict:
    """Bóc dict nghiệp vụ khỏi MCP content envelope."""
    return json.loads(envelope["content"][0]["text"])


# ── mount_role structural (không cần DB) ────────────────────────────────────


def test_mount_role_returns_triple():
    skill, server, allowed = mount_role("credit")
    assert isinstance(skill, str) and skill.startswith("# SKILL")
    assert allowed == [
        "mcp__banking_credit__cust_search",
        "mcp__banking_credit__cust_get",
        "mcp__banking_credit__credit_assess",
        "mcp__banking_credit__credit_cic_get",
    ]
    assert server is not None


async def test_mount_preserves_mcp_safety_annotations():
    """Annotations declared beside REGISTRY must survive the mount boundary."""
    _, credit_server, _ = mount_role("credit")
    credit = await credit_server["instance"]._get_cached_tool_definition("credit_assess")
    assert credit.annotations.readOnlyHint is True

    _, legal_server, _ = mount_role("legal")
    legal = await legal_server["instance"]._get_cached_tool_definition("legal_classify_profile")
    assert legal.annotations.readOnlyHint is False
    assert legal.annotations.idempotentHint is False

    _, ops_server, _ = mount_role("operations")
    ops_plan = await ops_server["instance"]._get_cached_tool_definition("ops_plan")
    disburse = await ops_server["instance"]._get_cached_tool_definition("disburse")
    assert ops_plan.annotations.readOnlyHint is True
    assert disburse.annotations.destructiveHint is True


# ── Verification #3: bad_param — fn KHÔNG chạy ──────────────────────────────


async def test_bad_param_blocks_before_fn():
    h = _make_handler(REGISTRY["credit_assess"], "credit_assess", SCHEMAS)
    out = _payload(await h({"owner": "C001"}))  # 'owner' sai (đúng: owner_id)
    assert out["code"] == "bad_param"
    assert "owner" in out["message"]
    assert out["retryable"] is True
    # hint liệt kê params hợp lệ để agent tự sửa
    assert "owner_id" in out["hint"]


async def test_bad_param_lists_valid_params():
    h = _make_handler(REGISTRY["cust_search"], "cust_search", SCHEMAS)
    out = _payload(await h({"query": "An"}))  # 'query' sai (đúng: q)
    assert out["code"] == "bad_param"


async def test_sync_tool_runs_via_to_thread(monkeypatch):
    """psycopg2/LAB sync không được chạy trực tiếp trên event loop."""
    called = {"to_thread": False}

    class DummyConn:
        def commit(self):
            pass

        def rollback(self):
            pass

    async def fake_to_thread(fn, *args):
        called["to_thread"] = True
        return fn(*args)

    monkeypatch.setattr(mount_module, "acquire", DummyConn)
    monkeypatch.setattr(mount_module, "release", lambda _conn: None)
    monkeypatch.setattr(mount_module.asyncio, "to_thread", fake_to_thread)

    def pure_tool(_conn, owner_id):
        return {"found": True, "owner_id": owner_id}

    h = _make_handler(
        pure_tool,
        "pure_tool",
        {"pure_tool": {"params": {"owner_id": {"type": "str", "required": True}}}},
    )
    out = _payload(await h({"owner_id": "C001"}))
    assert called["to_thread"] is True
    assert out == {"found": True, "owner_id": "C001"}


async def test_sync_tool_does_not_block_event_loop(monkeypatch):
    """Behavioral gate: while the tool waits in a worker, the loop can still release it."""
    gate = threading.Event()
    worker_thread = {"id": None}

    class DummyConn:
        def commit(self):
            pass

        def rollback(self):
            pass

    monkeypatch.setattr(mount_module, "acquire", DummyConn)
    monkeypatch.setattr(mount_module, "release", lambda _conn: None)

    def waiting_tool(_conn, owner_id):
        worker_thread["id"] = threading.get_ident()
        return {"released": gate.wait(0.5), "owner_id": owner_id}

    h = _make_handler(
        waiting_tool,
        "waiting_tool",
        {"waiting_tool": {"params": {"owner_id": {"type": "str", "required": True}}}},
    )
    pending = asyncio.create_task(h({"owner_id": "C001"}))
    await asyncio.sleep(0)
    gate.set()

    out = _payload(await pending)
    assert out["released"] is True
    assert worker_thread["id"] != threading.get_ident()


async def test_mount_handler_enforces_customer_owner_scope(monkeypatch):
    """The mount boundary must stop cross-customer access before the LAB function runs."""
    from app.orch import registry

    called = {"tool": False}

    class ScopeCursor:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, _sql, params):
            assert params == ("conv-customer",)

        def fetchone(self):
            return ("customer", "C001")

    class DummyConn:
        def cursor(self):
            return ScopeCursor()

        def commit(self):
            pass

        def rollback(self):
            pass

    monkeypatch.setattr(mount_module, "acquire", DummyConn)
    monkeypatch.setattr(mount_module, "release", lambda _conn: None)

    def should_not_run(_conn, owner_id):
        called["tool"] = True
        return {"owner_id": owner_id}

    h = _make_handler(
        should_not_run,
        "credit_assess",
        {"credit_assess": {"params": {"owner_id": {"type": "str", "required": True}}}},
    )
    token = registry.CTX_CONV.set("conv-customer")
    try:
        out = _payload(await h({"owner_id": "C999"}))
    finally:
        registry.CTX_CONV.reset(token)

    assert out["code"] == "forbidden"
    assert called["tool"] is False


# ── Verification #2: credit_assess(C001) qua mount handler → dscr==3.709 ─────


@requires_db
async def test_credit_assess_c001_dscr_via_mount():
    h = _make_handler(REGISTRY["credit_assess"], "credit_assess", SCHEMAS)
    out = _payload(await h({"owner_id": "C001"}))
    assert out["found"] is True
    assert out["item"]["metrics"]["dscr"] == 3.709
    assert out["item"]["metrics"]["monthlyPaymentTotalVnd"] == 8088576
    assert out["item"]["verdict"] == "info_only"  # loan_amount=0


@requires_db
async def test_credit_assess_direct_registry_c001():
    """Verification #2 form: REGISTRY['credit_assess'](PGConnAdapter(conn), owner_id='C001')."""
    import psycopg2

    from app.db.config import DATABASE_URL
    from app.mount.pg_adapter import PGConnAdapter

    conn = psycopg2.connect(DATABASE_URL)
    try:
        out = REGISTRY["credit_assess"](PGConnAdapter(conn), owner_id="C001")
        assert out["found"] is True
        assert out["item"]["metrics"]["dscr"] == 3.709
    finally:
        conn.close()


# ── bad_type: param sai kiểu → bad_type 4-field, không traceback ────────────


@requires_db
async def test_bad_type_envelope():
    h = _make_handler(REGISTRY["credit_assess"], "credit_assess", SCHEMAS)
    out = _payload(await h({"owner_id": "C001", "loan_amount_vnd": "abc"}))
    assert out["code"] == "bad_type"
    assert out["retryable"] is False


# ── envelope shape: mọi tool trả MCP content envelope ───────────────────────


@requires_db
async def test_all_credit_tools_return_envelope():
    for name in REGISTRY:
        h = _make_handler(REGISTRY[name], name, SCHEMAS)
        # gọi với 1 param hợp lệ tối thiểu để không dừng ở bad_param
        args = (
            {"owner_id": "C001"}
            if name in ("credit_assess", "credit_cic_get")
            else {"q": "An"}
            if name == "cust_search"
            else {"id": "C001"}
        )
        env = await h(args)
        assert "content" in env
        assert env["content"][0]["type"] == "text"
        payload = json.loads(env["content"][0]["text"])
        assert isinstance(payload, dict)
