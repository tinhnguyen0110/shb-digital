"""Tool authorization must be enforced by code, not only by the LLM prompt."""

from __future__ import annotations

from app.orch.tool_scope import customer_tool_scope_error


class _Cursor:
    def __init__(self, row):
        self.row = row

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, _sql, params):
        assert params == ("conv-1",)

    def fetchone(self):
        return self.row


class _Conn:
    def __init__(self, row):
        self.row = row

    def cursor(self):
        return _Cursor(self.row)


def test_customer_can_only_get_own_profile():
    conn = _Conn(("customer", "C001"))
    assert customer_tool_scope_error(conn, "conv-1", "cust_get", {"id": "C001"}) is None

    err = customer_tool_scope_error(conn, "conv-1", "cust_get", {"id": "C002"})
    assert err == {
        "code": "forbidden",
        "message": "Hồ sơ yêu cầu không thuộc tài khoản khách hàng hiện tại.",
        "hint": "Chỉ xử lý hồ sơ gắn với tài khoản khách hàng hiện tại.",
        "retryable": False,
    }


def test_customer_search_and_disburse_are_denied():
    conn = _Conn(("customer", "C001"))
    assert customer_tool_scope_error(conn, "conv-1", "cust_search", {"q": "Nguyen"})["code"] == "forbidden"
    assert customer_tool_scope_error(conn, "conv-1", "disburse", {"loan_id": "L001"})["code"] == "forbidden"


def test_customer_owner_parameter_is_scoped():
    conn = _Conn(("customer", "C001"))
    assert customer_tool_scope_error(conn, "conv-1", "credit_assess", {"owner_id": "C001"}) is None
    assert customer_tool_scope_error(conn, "conv-1", "credit_assess", {"owner_id": "C999"})["code"] == "forbidden"


def test_bank_conversation_remains_unrestricted():
    conn = _Conn(("user", None))
    assert customer_tool_scope_error(conn, "conv-1", "cust_search", {"q": "Nguyen"}) is None
    assert customer_tool_scope_error(conn, "conv-1", "credit_assess", {"owner_id": "C999"}) is None


def test_unknown_nonempty_conversation_fails_closed():
    err = customer_tool_scope_error(_Conn(None), "conv-1", "cust_get", {"id": "C001"})
    assert err is not None and err["code"] == "forbidden"


def test_empty_context_is_reserved_for_internal_invocation():
    assert customer_tool_scope_error(object(), "", "credit_assess", {"owner_id": "C999"}) is None
