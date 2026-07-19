"""regional tenants and feature RBAC

Revision ID: d9f7a4c2b601
Revises: b2e8d4f16a70
Create Date: 2026-07-19 00:00:00.000000
"""

from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d9f7a4c2b601"
down_revision: Union[str, Sequence[str], None] = "b2e8d4f16a70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TENANTS = (
    ("shb-north", "north", "SHB Bán lẻ · Miền Bắc"),
    ("shb-central", "central", "SHB Bán lẻ · Miền Trung"),
    ("shb-south", "south", "SHB Bán lẻ · Miền Nam"),
)

_USER_PERMISSIONS = [
    "cases.read",
    "cases.create",
    "cases.review",
    "products.read",
    "policies.read",
]
_ADMIN_PERMISSIONS = [
    *_USER_PERMISSIONS,
    "cases.approve",
    "policies.manage",
    "monitoring.read",
    "users.read",
    "users.create",
    "users.manage",
    "roles.read",
    "roles.manage",
]
_CUSTOMER_PERMISSIONS = ["cases.read", "cases.create", "cases.review"]


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("region", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("region"),
    )

    tenant_table = sa.table(
        "tenants",
        sa.column("id", sa.Text()),
        sa.column("region", sa.Text()),
        sa.column("display_name", sa.Text()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        tenant_table,
        [
            {"id": tenant_id, "region": region, "display_name": name, "is_active": True}
            for tenant_id, region, name in _TENANTS
        ],
    )

    op.create_table(
        "tenant_role_permissions",
        sa.Column("tenant_id", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("tenant_id", "role"),
        sa.CheckConstraint("role IN ('user', 'admin', 'customer')", name="ck_tenant_role_known"),
    )
    permission_rows = []
    for tenant_id, _region, _name in _TENANTS:
        permission_rows.extend(
            [
                {"tenant_id": tenant_id, "role": "user", "permissions": _USER_PERMISSIONS},
                {"tenant_id": tenant_id, "role": "admin", "permissions": _ADMIN_PERMISSIONS},
                {"tenant_id": tenant_id, "role": "customer", "permissions": _CUSTOMER_PERMISSIONS},
            ]
        )
    for row in permission_rows:
        op.execute(
            sa.text(
                "INSERT INTO tenant_role_permissions (tenant_id, role, permissions) "
                "VALUES (:tenant_id, :role, CAST(:permissions AS jsonb))"
            ).bindparams(
                tenant_id=row["tenant_id"],
                role=row["role"],
                permissions=json.dumps(row["permissions"]),
            )
        )

    op.add_column(
        "users",
        sa.Column("tenant_id", sa.Text(), server_default="shb-north", nullable=True),
    )
    op.add_column("users", sa.Column("display_name", sa.Text(), server_default="", nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column(
        "users",
        sa.Column(
            "activation_required",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.create_foreign_key("fk_users_tenant", "users", "tenants", ["tenant_id"], ["id"])
    op.execute("UPDATE users SET tenant_id='shb-north' WHERE tenant_id IS NULL")
    op.execute("UPDATE users SET display_name=username WHERE display_name IS NULL OR display_name=''")
    op.alter_column("users", "tenant_id", nullable=False)
    op.alter_column("users", "display_name", nullable=False)
    op.create_check_constraint("ck_users_known_role", "users", "role IN ('user', 'admin', 'customer')")
    op.create_index("ix_users_tenant_role", "users", ["tenant_id", "role"])

    op.add_column(
        "conversations",
        sa.Column("tenant_id", sa.Text(), server_default="shb-north", nullable=True),
    )
    op.create_foreign_key("fk_conversations_tenant", "conversations", "tenants", ["tenant_id"], ["id"])
    op.execute(
        "UPDATE conversations c SET tenant_id=COALESCE(u.tenant_id, 'shb-north') "
        "FROM users u WHERE c.user_id=u.username"
    )
    op.execute("UPDATE conversations SET tenant_id='shb-north' WHERE tenant_id IS NULL")
    op.alter_column("conversations", "tenant_id", nullable=False)
    op.create_index("ix_conversations_tenant_created", "conversations", ["tenant_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_conversations_tenant_created", table_name="conversations")
    op.drop_constraint("fk_conversations_tenant", "conversations", type_="foreignkey")
    op.drop_column("conversations", "tenant_id")

    op.drop_index("ix_users_tenant_role", table_name="users")
    op.drop_constraint("ck_users_known_role", "users", type_="check")
    op.drop_constraint("fk_users_tenant", "users", type_="foreignkey")
    op.drop_column("users", "activation_required")
    op.drop_column("users", "is_active")
    op.drop_column("users", "display_name")
    op.drop_column("users", "tenant_id")

    op.drop_table("tenant_role_permissions")
    op.drop_table("tenants")
