import {
  Check,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { conversationApi } from '../api';
import {
  ADMIN_ONLY_PERMISSIONS,
  can,
  type Permission,
} from '../rbac';
import type { AccessUser, AuthUser, RoleAccess } from '../types';
import './AccessManagementView.css';

interface AccessManagementViewProps {
  user: AuthUser;
}

type RoleFilter = 'all' | AccessUser['role'];
type StatusFilter = 'all' | 'active' | 'inactive';

interface PermissionDefinition {
  key: Permission;
  group: string;
  label: string;
  description: string;
}

const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'cases.read',
    group: 'Hồ sơ vay',
    label: 'Xem hồ sơ',
    description: 'Xem hồ sơ thuộc phạm vi đơn vị được phân công.',
  },
  {
    key: 'cases.create',
    group: 'Hồ sơ vay',
    label: 'Tạo hồ sơ',
    description: 'Tiếp nhận và khởi tạo một hồ sơ vay mới.',
  },
  {
    key: 'cases.review',
    group: 'Hồ sơ vay',
    label: 'Thẩm định hồ sơ',
    description: 'Bổ sung kết quả kiểm tra và nhận định nghiệp vụ.',
  },
  {
    key: 'cases.approve',
    group: 'Hồ sơ vay',
    label: 'Phê duyệt hồ sơ',
    description: 'Xác nhận quyết định cuối cùng theo thẩm quyền.',
  },
  {
    key: 'products.read',
    group: 'Sản phẩm & chính sách',
    label: 'Tra cứu sản phẩm',
    description: 'Xem điều kiện, hạn mức và thông tin sản phẩm.',
  },
  {
    key: 'policies.read',
    group: 'Sản phẩm & chính sách',
    label: 'Tra cứu chính sách',
    description: 'Xem quy định và hướng dẫn nghiệp vụ đang áp dụng.',
  },
  {
    key: 'policies.manage',
    group: 'Sản phẩm & chính sách',
    label: 'Quản lý chính sách',
    description: 'Cập nhật nội dung chính sách dùng trong hệ thống.',
  },
  {
    key: 'monitoring.read',
    group: 'Giám sát',
    label: 'Xem báo cáo vận hành',
    description: 'Theo dõi tình trạng xử lý và số liệu tổng hợp.',
  },
];

const KNOWN_PERMISSION_KEYS = new Set(
  PERMISSION_DEFINITIONS.map((permission) => permission.key),
);

const PERMISSION_DEPENDENCIES: Partial<Record<Permission, Permission[]>> = {
  'cases.create': ['cases.read'],
  'cases.review': ['cases.read'],
  'cases.approve': ['cases.read', 'cases.review'],
  'policies.manage': ['policies.read'],
};

const ROLE_LABELS: Record<AccessUser['role'], string> = {
  admin: 'Quản lý',
  user: 'Nhân viên tín dụng',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isSamePermissionSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((permission) => rightSet.has(permission));
};

export function AccessManagementView({ user }: AccessManagementViewProps) {
  const [usersData, setUsersData] = useState<AccessUser[]>([]);
  const [roleAccess, setRoleAccess] = useState<RoleAccess[]>([]);
  const [employeePermissions, setEmployeePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const loadAccessData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setActionError('');

    try {
      const [userRows, accessRows] = await Promise.all([
        conversationApi.listAccessUsers(),
        conversationApi.listRoleAccess(),
      ]);
      setUsersData(userRows);
      setRoleAccess(accessRows);
      setEmployeePermissions(
        accessRows.find((access) => access.role === 'user')?.permissions ?? [],
      );
    } catch (error) {
      setLoadError(
        getErrorMessage(
          error,
          'Chưa thể tải thông tin người dùng. Vui lòng thử lại.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccessData();
  }, [loadAccessData]);

  useEffect(() => {
    if (!createOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setCreateOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => previouslyFocused?.focus(), 0);
    };
  }, [createOpen]);

  const contextUser = user as AuthUser & {
    tenant_id?: string;
    tenant_name?: string;
  };
  const unitName =
    contextUser.tenant_name ??
    usersData.find((accessUser) => accessUser.tenant_name)?.tenant_name ??
    'Đơn vị được phân công';

  const employeeAccess = useMemo(
    () => roleAccess.find((access) => access.role === 'user'),
    [roleAccess],
  );
  const managerAccess = useMemo(
    () => roleAccess.find((access) => access.role === 'admin'),
    [roleAccess],
  );

  const permissionsChanged = useMemo(
    () =>
      employeeAccess
        ? !isSamePermissionSet(employeePermissions, employeeAccess.permissions)
        : false,
    [employeeAccess, employeePermissions],
  );

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('vi');
  const filteredUsers = useMemo(
    () =>
      usersData.filter((accessUser) => {
        const matchesSearch =
          !normalizedSearch ||
          accessUser.display_name
            .toLocaleLowerCase('vi')
            .includes(normalizedSearch) ||
          accessUser.username
            .toLocaleLowerCase('vi')
            .includes(normalizedSearch);
        const matchesRole =
          roleFilter === 'all' || accessUser.role === roleFilter;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active'
            ? accessUser.active
            : !accessUser.active);
        return matchesSearch && matchesRole && matchesStatus;
      }),
    [normalizedSearch, roleFilter, statusFilter, usersData],
  );

  const activeUserCount = usersData.filter(
    (accessUser) => accessUser.active,
  ).length;
  const managerCount = usersData.filter(
    (accessUser) => accessUser.role === 'admin',
  ).length;

  const clearFeedback = () => {
    setActionError('');
    setSuccessMessage('');
  };

  const handleActiveChange = async (accessUser: AccessUser) => {
    const isCurrentUser = accessUser.username === user.username;
    if (isCurrentUser || updatingUserId) return;

    clearFeedback();
    setUpdatingUserId(accessUser.id);
    try {
      await conversationApi.updateAccessUser(accessUser.id, {
        active: !accessUser.active,
      });
      setUsersData((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === accessUser.id
            ? { ...currentUser, active: !currentUser.active }
            : currentUser,
        ),
      );
      setSuccessMessage(
        accessUser.active
          ? `Đã vô hiệu hóa tài khoản của ${accessUser.display_name}.`
          : `Đã kích hoạt tài khoản của ${accessUser.display_name}.`,
      );
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          'Chưa thể cập nhật trạng thái tài khoản. Vui lòng thử lại.',
        ),
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleEmployeePermission = (permissionKey: Permission) => {
    clearFeedback();
    setEmployeePermissions((currentPermissions) => {
      const nextPermissions = new Set(currentPermissions);
      if (nextPermissions.has(permissionKey)) {
        nextPermissions.delete(permissionKey);

        // Khi bỏ quyền nền, bỏ luôn các thao tác phụ thuộc để ma trận không tạo
        // một vai trò có thể "thẩm định" nhưng lại không thể xem hồ sơ.
        let changed = true;
        while (changed) {
          changed = false;
          for (const [candidate, requirements] of Object.entries(
            PERMISSION_DEPENDENCIES,
          ) as Array<[Permission, Permission[]]>) {
            if (
              nextPermissions.has(candidate) &&
              requirements.some((required) => !nextPermissions.has(required))
            ) {
              nextPermissions.delete(candidate);
              changed = true;
            }
          }
        }
      } else {
        nextPermissions.add(permissionKey);
        for (const required of PERMISSION_DEPENDENCIES[permissionKey] ?? []) {
          nextPermissions.add(required);
        }
      }
      return [...nextPermissions];
    });
  };

  const handleSavePermissions = async () => {
    if (!employeeAccess || !permissionsChanged || savingPermissions) return;

    clearFeedback();
    setSavingPermissions(true);
    const systemManagedPermissions = employeeAccess.permissions.filter(
      (permission) =>
        !KNOWN_PERMISSION_KEYS.has(permission as Permission) &&
        !ADMIN_ONLY_PERMISSIONS.has(permission as Permission),
    );
    const selectedKnownPermissions = PERMISSION_DEFINITIONS.filter(
      (permission) => employeePermissions.includes(permission.key),
    ).map((permission) => permission.key);
    const nextPermissions = [
      ...systemManagedPermissions,
      ...selectedKnownPermissions,
    ];

    try {
      await conversationApi.updateRoleAccess('user', nextPermissions);
      setEmployeePermissions(nextPermissions);
      setRoleAccess((currentAccess) =>
        currentAccess.map((access) =>
          access.role === 'user'
            ? { ...access, permissions: nextPermissions }
            : access,
        ),
      );
      setSuccessMessage('Đã lưu quyền cho Nhân viên tín dụng.');
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          'Chưa thể lưu thay đổi quyền. Vui lòng thử lại.',
        ),
      );
    } finally {
      setSavingPermissions(false);
    }
  };

  const openCreateDialog = () => {
    clearFeedback();
    setCreateError('');
    setCreateOpen(true);
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creatingUser) return;

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get('display_name') ?? '').trim();
    const username = String(formData.get('username') ?? '').trim();

    if (displayName.length < 2) {
      setCreateError('Họ và tên cần có ít nhất 2 ký tự.');
      nameInputRef.current?.focus();
      return;
    }
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
      setCreateError(
        'Tên đăng nhập cần từ 3–64 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.',
      );
      return;
    }
    setCreatingUser(true);
    setCreateError('');
    try {
      await conversationApi.createAccessUser({
        username,
        display_name: displayName,
        role: 'user',
      });
      const refreshedUsers = await conversationApi.listAccessUsers();
      setUsersData(refreshedUsers);
      setCreateOpen(false);
      setSuccessMessage(
        `Đã tạo tài khoản cho ${displayName}. Tài khoản đang chờ quy trình kích hoạt.`,
      );
    } catch (error) {
      setCreateError(
        getErrorMessage(
          error,
          'Chưa thể tạo người dùng. Vui lòng kiểm tra thông tin và thử lại.',
        ),
      );
    } finally {
      setCreatingUser(false);
    }
  };

  if (user.role !== 'admin') {
    return (
      <section className="access-management access-management--restricted">
        <div className="access-restricted-card" role="status">
          <LockKeyhole aria-hidden="true" size={28} />
          <div>
            <h1>Người dùng &amp; phân quyền</h1>
            <p>Chỉ Quản lý mới có thể truy cập khu vực này.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-management" aria-labelledby="access-page-title">
      <header className="access-hero">
        <div className="access-hero__identity">
          <span className="access-hero__icon" aria-hidden="true">
            <UserRoundCog size={22} />
          </span>
          <div>
            <p className="access-eyebrow">Quản trị nội bộ</p>
            <h1 id="access-page-title">Người dùng &amp; phân quyền</h1>
            <p className="access-hero__description">
              Quản lý tài khoản và phạm vi thao tác trong đơn vị.
            </p>
          </div>
        </div>
        <div className="access-hero__actions">
          <div className="access-unit-context" aria-label={`Đơn vị: ${unitName}`}>
            <span>Đơn vị</span>
            <strong>{unitName}</strong>
          </div>
          {can(user, 'users.create') ? (
            <button
              className="access-button access-button--primary"
              type="button"
              onClick={openCreateDialog}
            >
              <Plus aria-hidden="true" size={17} />
              Thêm người dùng
            </button>
          ) : null}
        </div>
      </header>

      {successMessage ? (
        <div className="access-feedback access-feedback--success" role="status">
          <Check aria-hidden="true" size={17} />
          <span>{successMessage}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setSuccessMessage('')}
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      ) : null}
      {actionError ? (
        <div className="access-feedback access-feedback--error" role="alert">
          <CircleAlert aria-hidden="true" size={17} />
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setActionError('')}
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="access-state-card" role="status" aria-live="polite">
          <LoaderCircle
            className="access-spin"
            aria-hidden="true"
            size={24}
          />
          <strong>Đang tải dữ liệu quản trị</strong>
          <span>Thông tin người dùng và quyền thao tác đang được cập nhật.</span>
        </div>
      ) : loadError ? (
        <div className="access-state-card access-state-card--error" role="alert">
          <CircleAlert aria-hidden="true" size={25} />
          <strong>Không thể tải dữ liệu</strong>
          <span>{loadError}</span>
          <button
            className="access-button access-button--secondary"
            type="button"
            onClick={() => void loadAccessData()}
          >
            <RefreshCw aria-hidden="true" size={16} />
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <div className="access-summary" aria-label="Tổng quan người dùng">
            <article className="access-summary-card">
              <span className="access-summary-card__icon" aria-hidden="true">
                <Users size={18} />
              </span>
              <div>
                <span>Tổng người dùng</span>
                <strong>{usersData.length}</strong>
              </div>
            </article>
            <article className="access-summary-card">
              <span
                className="access-summary-card__icon access-summary-card__icon--success"
                aria-hidden="true"
              >
                <Check size={18} />
              </span>
              <div>
                <span>Đang hoạt động</span>
                <strong>{activeUserCount}</strong>
              </div>
            </article>
            <article className="access-summary-card">
              <span
                className="access-summary-card__icon access-summary-card__icon--secure"
                aria-hidden="true"
              >
                <ShieldCheck size={18} />
              </span>
              <div>
                <span>Quản lý</span>
                <strong>{managerCount}</strong>
              </div>
            </article>
          </div>

          <article className="access-card" aria-labelledby="users-card-title">
            <div className="access-card__heading">
              <div>
                <h2 id="users-card-title">Danh sách người dùng</h2>
                <p>
                  Tìm kiếm, lọc và thay đổi trạng thái tài khoản trong đơn vị.
                </p>
              </div>
              <span className="access-count">
                {filteredUsers.length}/{usersData.length} người dùng
              </span>
            </div>

            <div className="access-toolbar">
              <label className="access-search">
                <Search aria-hidden="true" size={16} />
                <span className="access-sr-only">
                  Tìm theo họ tên hoặc tên đăng nhập
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm theo họ tên hoặc tên đăng nhập"
                />
              </label>
              <label className="access-filter">
                <span>Vai trò</span>
                <select
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.target.value as RoleFilter)
                  }
                >
                  <option value="all">Tất cả</option>
                  <option value="user">Nhân viên tín dụng</option>
                  <option value="admin">Quản lý</option>
                </select>
              </label>
              <label className="access-filter">
                <span>Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                >
                  <option value="all">Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Đã vô hiệu hóa</option>
                </select>
              </label>
            </div>

            {usersData.length === 0 ? (
              <div className="access-empty">
                <Users aria-hidden="true" size={24} />
                <strong>Chưa có người dùng</strong>
                <span>Thêm người dùng đầu tiên để bắt đầu phân công công việc.</span>
                {can(user, 'users.create') ? (
                  <button
                    className="access-button access-button--secondary"
                    type="button"
                    onClick={openCreateDialog}
                  >
                    <Plus aria-hidden="true" size={16} />
                    Thêm người dùng
                  </button>
                ) : null}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="access-empty">
                <Search aria-hidden="true" size={23} />
                <strong>Không tìm thấy kết quả</strong>
                <span>Thử thay đổi từ khóa hoặc bộ lọc đang chọn.</span>
                <button
                  className="access-button access-button--quiet"
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('all');
                    setStatusFilter('all');
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="access-table-wrap">
                <table className="access-users-table">
                  <caption className="access-sr-only">
                    Danh sách tài khoản thuộc {unitName}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Người dùng</th>
                      <th scope="col">Tên đăng nhập</th>
                      <th scope="col">Vai trò</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Hoạt động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((accessUser) => {
                      const isCurrentUser =
                        accessUser.username === user.username;
                      const isUpdating = updatingUserId === accessUser.id;
                      return (
                        <tr key={accessUser.id}>
                          <th scope="row" data-label="Người dùng">
                            <span className="access-avatar" aria-hidden="true">
                              {accessUser.display_name
                                .trim()
                                .charAt(0)
                                .toLocaleUpperCase('vi') || '?'}
                            </span>
                            <span className="access-user-name">
                              <strong>{accessUser.display_name}</strong>
                              {isCurrentUser ? <small>Bạn</small> : null}
                            </span>
                          </th>
                          <td data-label="Tên đăng nhập">
                            <span className="access-username">
                              {accessUser.username}
                            </span>
                          </td>
                          <td data-label="Vai trò">
                            <span
                              className={`access-role access-role--${accessUser.role}`}
                            >
                              {ROLE_LABELS[accessUser.role]}
                            </span>
                          </td>
                          <td data-label="Trạng thái">
                            <span
                              className={`access-status ${
                                accessUser.active
                                  ? 'access-status--active'
                                  : 'access-status--inactive'
                              }`}
                            >
                              <span aria-hidden="true" />
                              {accessUser.activation_required
                                ? 'Chờ kích hoạt'
                                : accessUser.active
                                  ? 'Đang hoạt động'
                                  : 'Đã vô hiệu hóa'}
                            </span>
                          </td>
                          <td data-label="Hoạt động">
                            <div className="access-switch-cell">
                              <button
                                className="access-switch"
                                type="button"
                                role="switch"
                                aria-checked={accessUser.active}
                                aria-label={`${
                                  accessUser.active
                                    ? 'Vô hiệu hóa'
                                    : 'Kích hoạt'
                                } tài khoản của ${accessUser.display_name}`}
                                disabled={
                                  isCurrentUser ||
                                  accessUser.activation_required ||
                                  !can(user, 'users.manage') ||
                                  Boolean(updatingUserId)
                                }
                                title={
                                  isCurrentUser
                                    ? 'Bạn không thể tự vô hiệu hóa tài khoản đang dùng.'
                                    : accessUser.activation_required
                                      ? 'Tài khoản đang chờ hoàn tất quy trình kích hoạt.'
                                    : undefined
                                }
                                onClick={() =>
                                  void handleActiveChange(accessUser)
                                }
                              >
                                <span aria-hidden="true" />
                              </button>
                              {isUpdating ? (
                                <LoaderCircle
                                  className="access-spin"
                                  aria-label="Đang cập nhật"
                                  size={15}
                                />
                              ) : isCurrentUser ? (
                                <small>Tài khoản đang dùng</small>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article
            className="access-card"
            aria-labelledby="permissions-card-title"
          >
            <div className="access-card__heading access-card__heading--permissions">
              <div>
                <h2 id="permissions-card-title">Quyền theo vai trò</h2>
                <p>
                  Chọn các thao tác Nhân viên tín dụng được phép thực hiện.
                </p>
              </div>
              <div className="access-protected-note">
                <LockKeyhole aria-hidden="true" size={15} />
                Quyền Quản lý được hệ thống bảo vệ
              </div>
            </div>

            {!employeeAccess || !managerAccess ? (
              <div className="access-inline-warning" role="alert">
                <CircleAlert aria-hidden="true" size={17} />
                <span>
                  Chưa đủ thông tin vai trò để hiển thị bảng quyền. Vui lòng
                  tải lại trang hoặc liên hệ bộ phận vận hành.
                </span>
              </div>
            ) : (
              <>
                <div className="access-table-wrap access-table-wrap--permissions">
                  <table className="access-permission-table">
                    <caption className="access-sr-only">
                      Quyền thao tác của Quản lý và Nhân viên tín dụng
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Khu vực &amp; thao tác</th>
                        <th scope="col">
                          <span>Quản lý</span>
                          <small>Được bảo vệ</small>
                        </th>
                        <th scope="col">
                          <span>Nhân viên tín dụng</span>
                          <small>Có thể chỉnh sửa</small>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_DEFINITIONS.map((permission) => {
                        const managerHasPermission =
                          managerAccess.permissions.includes(permission.key);
                        const employeeHasPermission =
                          employeePermissions.includes(permission.key);
                        return (
                          <tr key={permission.key}>
                            <th scope="row">
                              <small>{permission.group}</small>
                              <strong>{permission.label}</strong>
                              <span>{permission.description}</span>
                            </th>
                            <td>
                              <span
                                className={`access-permission-state ${
                                  managerHasPermission
                                    ? 'access-permission-state--granted'
                                    : 'access-permission-state--not-granted'
                                }`}
                              >
                                {managerHasPermission ? (
                                  <>
                                    <Check aria-hidden="true" size={15} />
                                    <span>Có</span>
                                  </>
                                ) : (
                                  <span>Không</span>
                                )}
                              </span>
                            </td>
                            <td>
                              <label className="access-permission-check">
                                <input
                                  type="checkbox"
                                  checked={employeeHasPermission}
                                  onChange={() =>
                                    toggleEmployeePermission(permission.key)
                                  }
                                />
                                <span aria-hidden="true">
                                  <Check size={14} />
                                </span>
                                <span className="access-sr-only">
                                  Cho phép Nhân viên tín dụng: {permission.label}
                                </span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="access-permission-footer">
                  <p>
                    {permissionsChanged
                      ? 'Bạn có thay đổi chưa được lưu.'
                      : 'Mọi thay đổi đã được lưu.'}
                  </p>
                  <button
                    className="access-button access-button--primary"
                    type="button"
                    disabled={!permissionsChanged || savingPermissions}
                    onClick={() => void handleSavePermissions()}
                  >
                    {savingPermissions ? (
                      <LoaderCircle
                        className="access-spin"
                        aria-hidden="true"
                        size={16}
                      />
                    ) : (
                      <KeyRound aria-hidden="true" size={16} />
                    )}
                    {savingPermissions
                      ? 'Đang lưu'
                      : 'Lưu quyền Nhân viên tín dụng'}
                  </button>
                </div>
              </>
            )}
          </article>
        </>
      )}

      {createOpen ? (
        <div className="access-dialog-layer">
          <button
            className="access-dialog-backdrop"
            type="button"
            aria-label="Đóng hộp thoại thêm người dùng"
            onClick={() => setCreateOpen(false)}
          />
          <div
            ref={dialogRef}
            className="access-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-create-title"
            aria-describedby="access-create-description"
          >
            <div className="access-dialog__heading">
              <div>
                <span className="access-dialog__icon" aria-hidden="true">
                  <Plus size={18} />
                </span>
                <div>
                  <h2 id="access-create-title">Thêm người dùng</h2>
                  <p id="access-create-description">
                    Tạo tài khoản mới trong {unitName}.
                  </p>
                </div>
              </div>
              <button
                className="access-dialog__close"
                type="button"
                aria-label="Đóng"
                onClick={() => setCreateOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <form onSubmit={(event) => void handleCreateUser(event)}>
              <div className="access-form-grid">
                <label className="access-field access-field--full">
                  <span>
                    Họ và tên <em aria-hidden="true">*</em>
                  </span>
                  <input
                    ref={nameInputRef}
                    name="display_name"
                    type="text"
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    required
                    placeholder="Nguyễn Văn An"
                  />
                </label>
                <label className="access-field">
                  <span>
                    Tên đăng nhập <em aria-hidden="true">*</em>
                  </span>
                  <input
                    name="username"
                    type="text"
                    autoComplete="username"
                    minLength={3}
                    maxLength={64}
                    pattern="[A-Za-z0-9._-]+"
                    required
                    placeholder="nguyen.van.an"
                  />
                  <small>Chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.</small>
                </label>
                <div className="access-field">
                  <span>
                    Vai trò
                  </span>
                  <div className="access-readonly-field" aria-readonly="true">
                    <LockKeyhole aria-hidden="true" size={15} />
                    Nhân viên tín dụng
                  </div>
                  <small>Tài khoản Quản lý do bộ phận quản trị danh tính cấp.</small>
                </div>
                <div className="access-field access-field--full">
                  <span>Đơn vị</span>
                  <div className="access-readonly-field" aria-readonly="true">
                    <LockKeyhole aria-hidden="true" size={15} />
                    {unitName}
                  </div>
                </div>
              </div>

              <div className="access-invitation-note">
                <ShieldCheck aria-hidden="true" size={18} />
                <p>
                  <strong>Kích hoạt an toàn</strong>
                  <span>
                    Tài khoản mới sẽ chờ quy trình kích hoạt. Mật khẩu tạm thời
                    không được hiển thị hoặc thu thập tại đây.
                  </span>
                </p>
              </div>

              {createError ? (
                <div className="access-inline-warning" role="alert">
                  <CircleAlert aria-hidden="true" size={17} />
                  <span>{createError}</span>
                </div>
              ) : null}

              <div className="access-dialog__footer">
                <button
                  className="access-button access-button--quiet"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="access-button access-button--primary"
                  type="submit"
                  disabled={creatingUser}
                >
                  {creatingUser ? (
                    <LoaderCircle
                      className="access-spin"
                      aria-hidden="true"
                      size={16}
                    />
                  ) : (
                    <Plus aria-hidden="true" size={16} />
                  )}
                  {creatingUser ? 'Đang tạo' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AccessManagementView;
