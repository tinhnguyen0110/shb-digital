"""Authorization boundary for customer-originated tool calls.

The customer identity in a prompt is useful guidance, but it is not an access-control
boundary. This module derives the caller from the conversation creator and enforces the
owner scope again on the same database connection used by the tool.
"""

from __future__ import annotations

from typing import Any


def _forbidden(message: str) -> dict[str, Any]:
    return {
        "code": "forbidden",
        "message": message,
        "hint": "Chỉ xử lý hồ sơ gắn với tài khoản khách hàng hiện tại.",
        "retryable": False,
    }


def customer_tool_scope_error(
    conn: Any,
    conv_id: str,
    tool_name: str,
    args: dict[str, Any],
) -> dict[str, Any] | None:
    """Return a 4-field error when a customer conversation crosses its owner scope.

    Empty ``conv_id`` is reserved for trusted internal/direct invocations such as tests and
    maintenance. A non-empty but unknown conversation fails closed. Bank-created conversations
    (RM/admin) keep their current cross-customer workflow.
    """
    if not conv_id:
        return None

    with conn.cursor() as cur:
        cur.execute(
            "SELECT u.role, u.owner_id "
            "FROM conversations c JOIN users u ON c.user_id=u.username "
            "WHERE c.id::text=%s",
            (conv_id,),
        )
        row = cur.fetchone()

    if not row:
        return _forbidden("Không xác định được phạm vi truy cập của ca.")

    role, owner_id = row[0], row[1]
    if role != "customer":
        return None
    if not owner_id:
        return _forbidden("Tài khoản khách hàng chưa được gắn với hồ sơ.")

    # Search can enumerate other customers even when the prompt says not to.
    if tool_name == "cust_search":
        return _forbidden("Khách hàng không được tìm kiếm danh sách hồ sơ.")

    # Stage 3 is outside the customer self-service scope. Keep irreversible execution
    # behind bank-side orchestration and human approval.
    if tool_name == "disburse":
        return _forbidden("Khách hàng không được khởi tạo thao tác giải ngân.")

    owner_param = "id" if tool_name == "cust_get" else "owner_id"
    if owner_param not in args:
        return None  # generic tools without an owner dimension (for example policy lookup)
    if str(args[owner_param]) != str(owner_id):
        return _forbidden("Hồ sơ yêu cầu không thuộc tài khoản khách hàng hiện tại.")
    return None
