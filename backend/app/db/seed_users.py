"""Seed account demo.

Chạy sau migration: `uv run python -m app.db.seed_users`.
Idempotent: ON CONFLICT (username) DO NOTHING — chạy lại không đổi pass đã có.
Password demo = username — on-premise demo; PROD đổi qua env sau.

Luồng demo được hỗ trợ: staff/admin đăng nhập; khách vay dùng luồng công khai, không đăng nhập.
`user` và các account customer D-56 cũ vẫn được seed tạm thời để tương thích test/demo legacy.
"""

from __future__ import annotations

import os

import psycopg2
import psycopg2.extras

from app.auth.permissions import DEFAULT_ROLE_PERMISSIONS
from app.auth.security import hash_password
from app.db.config import DATABASE_URL

# (username, password, role, owner_id). Password demo = username; owner_id: bank=None, khách=mã owner.
SEED_ACCOUNTS = [
    ("staff", os.environ.get("SEED_STAFF_PASSWORD", "staff"), "user", None),  # NHÂN VIÊN (role legacy)
    ("user", os.environ.get("SEED_USER_PASSWORD", "user"), "user", None),  # NGÂN HÀNG (RM)
    ("admin", os.environ.get("SEED_ADMIN_PASSWORD", "admin"), "admin", None),  # NGÂN HÀNG (quản lý)
    ("c001", os.environ.get("SEED_C001_PASSWORD", "c001"), "customer", "C001"),  # KHÁCH cá nhân → C001
    ("b001", os.environ.get("SEED_B001_PASSWORD", "b001"), "customer", "B001"),  # KHÁCH DN → B001
    # T7-4: KHÁCH C019 (Huỳnh Văn Phong) — lane-green cả 300/700tr + loan L108 594tr active =
    # tổ hợp DUY NHẤT cho cảnh demo "hồ sơ XANH tự duyệt TRÊN ngưỡng" (c001/C001 yellow = tương phản).
    ("c019", os.environ.get("SEED_C019_PASSWORD", "c019"), "customer", "C019"),
    ("staff_central", os.environ.get("SEED_STAFF_CENTRAL_PASSWORD", "staff_central"), "user", None),
    ("admin_central", os.environ.get("SEED_ADMIN_CENTRAL_PASSWORD", "admin_central"), "admin", None),
    ("staff_south", os.environ.get("SEED_STAFF_SOUTH_PASSWORD", "staff_south"), "user", None),
    ("admin_south", os.environ.get("SEED_ADMIN_SOUTH_PASSWORD", "admin_south"), "admin", None),
]

SEED_TENANTS = (
    ("shb-north", "north", "SHB Bán lẻ · Miền Bắc"),
    ("shb-central", "central", "SHB Bán lẻ · Miền Trung"),
    ("shb-south", "south", "SHB Bán lẻ · Miền Nam"),
)

SEED_ACCOUNT_PROFILES: dict[str, tuple[str, str, bool]] = {
    "staff": ("shb-north", "Nhân viên tín dụng Miền Bắc", True),
    "user": ("shb-north", "Nhân viên RM legacy", True),
    "admin": ("shb-north", "Quản lý Miền Bắc", True),
    "c001": ("shb-north", "Khách hàng legacy C001", True),
    "b001": ("shb-north", "Khách hàng legacy B001", True),
    "c019": ("shb-north", "Khách hàng legacy C019", True),
    "staff_central": ("shb-central", "Nhân viên tín dụng Miền Trung", True),
    "admin_central": ("shb-central", "Quản lý Miền Trung", True),
    "staff_south": ("shb-south", "Nhân viên tín dụng Miền Nam", True),
    "admin_south": ("shb-south", "Quản lý Miền Nam", True),
}


def seed_users(database_url: str = DATABASE_URL) -> dict[str, str]:
    """Insert account (idempotent). Trả {username: role} đã đảm bảo tồn tại. owner_id set cho khách."""
    conn = psycopg2.connect(database_url)
    out: dict[str, str] = {}
    try:
        with conn.cursor() as cur:
            for tenant_id, region, display_name in SEED_TENANTS:
                cur.execute(
                    "INSERT INTO tenants (id, region, display_name, is_active) VALUES (%s,%s,%s,true) "
                    "ON CONFLICT (id) DO NOTHING",
                    (tenant_id, region, display_name),
                )
                for role, permissions in DEFAULT_ROLE_PERMISSIONS.items():
                    cur.execute(
                        "INSERT INTO tenant_role_permissions (tenant_id, role, permissions) VALUES (%s,%s,%s) "
                        "ON CONFLICT (tenant_id, role) DO NOTHING",
                        (tenant_id, role, psycopg2.extras.Json(list(permissions))),
                    )
            for username, password, role, owner_id in SEED_ACCOUNTS:
                tenant_id, display_name, is_active = SEED_ACCOUNT_PROFILES[username]
                cur.execute(
                    "INSERT INTO users "
                    "(username, pass_hash, role, owner_id, tenant_id, display_name, is_active, "
                    "activation_required) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,false) "
                    "ON CONFLICT (username) DO UPDATE SET "
                    "tenant_id=EXCLUDED.tenant_id, display_name=EXCLUDED.display_name, "
                    "is_active=EXCLUDED.is_active, activation_required=false",
                    (username, hash_password(password), role, owner_id, tenant_id, display_name, is_active),
                )
                out[username] = role
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return out


if __name__ == "__main__":
    result = seed_users()
    for username, role in result.items():
        print(f"user seeded: {username} ({role})")
