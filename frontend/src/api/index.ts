// api/index.ts — cổng duy nhất app dùng để nói chuyện với "backend". Cờ VITE_USE_MOCK_API
// chọn mock hay REST thật. Mọi development server mặc định bật mock để bản demo chạy độc lập;
// `npm run dev:api` đặt cờ false để dùng REST thật. Production build mặc định dùng REST thật.
// Mọi report/log PHẢI khai trạng thái cờ này (CLAUDE.md nghề FE — mock sau CỜ ENV tắt-được).

import { apiClient, ApiRequestError } from './client';
import { createMockEventSource, mockBackend, type MinimalEventSource } from './mock';
import {
  DEFAULT_ROLE_ACCESS,
  DEMO_PASSWORDS,
  INITIAL_ACCESS_USERS,
  toAuthUser,
} from '../data/access';
import type {
  AccessUser,
  ApprovalRow,
  AuditRow,
  AuthUser,
  CompareResult,
  Conversation,
  ConversationFullState,
  LoginResult,
  ModelsResponse,
  RoleAccess,
} from '../types';

const mockFlag = import.meta.env.VITE_USE_MOCK_API;
export const USE_MOCK_API =
  mockFlag === 'true' ||
  (mockFlag == null && (import.meta.env.DEV || import.meta.env.MODE === 'test'));

export interface ConversationApi {
  login(username: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  me(): Promise<{ user: AuthUser }>;
  listConversations(): Promise<Conversation[]>;
  createConversation(title: string, provider?: string, model?: string): Promise<Conversation>;
  getConversation(id: string): Promise<ConversationFullState>;
  sendChat(id: string, content: string): Promise<void>;
  decideApproval(id: string, decision: 'approved' | 'rejected', reason: string): Promise<unknown>;
  auditByConv(convId: string): Promise<AuditRow[]>;
  auditByTask(taskId: string): Promise<AuditRow[]>;
  interruptTask(convId: string, taskId: string): Promise<unknown>;
  // Control Tower (T4-6)
  listApprovals(status?: string): Promise<ApprovalRow[]>;
  auditFiltered(filters?: Record<string, string>): Promise<AuditRow[]>;
  getModels(): Promise<ModelsResponse>;
  runCompare(question: string): Promise<CompareResult>;
  listAccessUsers(): Promise<AccessUser[]>;
  createAccessUser(input: { username: string; display_name: string; role: 'user' }): Promise<AccessUser>;
  updateAccessUser(id: string, input: { active?: boolean }): Promise<AccessUser>;
  listRoleAccess(): Promise<RoleAccess[]>;
  updateRoleAccess(role: 'user' | 'admin', permissions: string[]): Promise<RoleAccess>;
  openEventSource(convId: string): MinimalEventSource;
}

let mockCurrentUser: AuthUser | null = null;
let mockUsers: AccessUser[] = INITIAL_ACCESS_USERS.map((item) => ({ ...item }));
const mockRoleAccess = new Map(
  (['shb-north', 'shb-central', 'shb-south'] as const).map((tenantId) => [
    tenantId,
    DEFAULT_ROLE_ACCESS.map((item) => ({ ...item, permissions: [...item.permissions] })),
  ]),
);

function mockUnauthorized(message = 'Bạn không có quyền thực hiện thao tác này.'): never {
  throw new ApiRequestError(
    403,
    { code: 'forbidden', message, hint: 'Liên hệ quản lý đơn vị nếu cần được cấp quyền.', retryable: false },
    message,
  );
}

function requireMockManager(): AuthUser {
  if (!mockCurrentUser?.tenant_id || mockCurrentUser.role !== 'admin') mockUnauthorized();
  return mockCurrentUser;
}

const mockApi: ConversationApi = {
  async login(username: string, password: string) {
    const account = mockUsers.find((candidate) => candidate.username === username);
    if (!account?.active || DEMO_PASSWORDS[username] !== password) {
      throw new ApiRequestError(
        401,
        {
          code: 'invalid_credentials',
          message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
          hint: 'Sử dụng tài khoản demo được cung cấp.',
          retryable: false,
        },
        'invalid credentials',
      );
    }
    const access = mockRoleAccess.get(account.tenant_id) ?? DEFAULT_ROLE_ACCESS;
    mockCurrentUser = toAuthUser(account, access);
    return {
      token: 'mock-token',
      user: mockCurrentUser,
    };
  },
  async me() {
    // Mock không lưu phiên qua reload. 401 chỉ giữ App ở cửa khách công khai; màn đăng nhập
    // nội bộ được mở bằng hành động “Dành cho nhân viên”.
    throw new ApiRequestError(401, { code: 'unauthorized', message: 'mock: chưa đăng nhập', hint: 'đăng nhập', retryable: false }, 'unauthorized');
  },
  async logout() {
    mockCurrentUser = null;
    return undefined;
  },
  async listConversations() {
    return mockBackend.listConversations(mockCurrentUser?.tenant_id ?? undefined);
  },
  async createConversation(title: string, provider?: string, model?: string) {
    return mockBackend.createConversation(title, provider, model, mockCurrentUser?.tenant_id ?? undefined);
  },
  async getConversation(id: string) {
    return mockBackend.getFullState(id);
  },
  async sendChat(id: string, content: string) {
    await mockBackend.sendChat(id, content);
  },
  async decideApproval(id: string, decision: 'approved' | 'rejected', reason: string) {
    await mockBackend.decideApproval(id, decision, reason);
  },
  async auditByConv(convId: string) {
    return mockBackend.auditByConv(convId);
  },
  async auditByTask(taskId: string) {
    return mockBackend.auditByTask(taskId);
  },
  async interruptTask(convId: string, taskId: string) {
    return mockBackend.interruptTask(convId, taskId);
  },
  async listApprovals(status = 'pending') {
    return mockBackend.listApprovals(status, mockCurrentUser?.tenant_id ?? undefined);
  },
  async auditFiltered(filters: Record<string, string> = {}) {
    return mockBackend.auditFiltered(filters, mockCurrentUser?.tenant_id ?? undefined);
  },
  async getModels() {
    return mockBackend.getModels();
  },
  async runCompare(question: string) {
    return mockBackend.runCompare(question);
  },
  async listAccessUsers() {
    const manager = requireMockManager();
    return mockUsers
      .filter((item) => item.tenant_id === manager.tenant_id)
      .map((item) => ({ ...item }));
  },
  async createAccessUser(input) {
    const manager = requireMockManager();
    const username = input.username.trim().toLowerCase();
    const displayName = input.display_name.trim();
    if (!username || !displayName) {
      throw new ApiRequestError(
        400,
        { code: 'bad_request', message: 'Cần nhập đủ họ tên và tên đăng nhập.', hint: 'Kiểm tra lại thông tin.', retryable: false },
        'bad request',
      );
    }
    if (mockUsers.some((item) => item.username === username)) {
      throw new ApiRequestError(
        409,
        { code: 'username_exists', message: 'Tên đăng nhập đã được sử dụng.', hint: 'Chọn tên đăng nhập khác.', retryable: false },
        'username exists',
      );
    }
    const created: AccessUser = {
      id: `usr-${manager.tenant_id}-${Date.now()}`,
      username,
      display_name: displayName,
      role: 'user',
      tenant_id: manager.tenant_id!,
      tenant_name: manager.tenant_name ?? '',
      active: false,
      activation_required: true,
    };
    mockUsers = [...mockUsers, created];
    return { ...created };
  },
  async updateAccessUser(id, input) {
    const manager = requireMockManager();
    const index = mockUsers.findIndex((item) => item.id === id && item.tenant_id === manager.tenant_id);
    if (index < 0) {
      throw new ApiRequestError(
        404,
        { code: 'not_found', message: 'Không tìm thấy người dùng trong đơn vị.', hint: 'Làm mới danh sách.', retryable: false },
        'not found',
      );
    }
    const target = mockUsers[index];
    if (target.username === manager.username && input.active === false) {
      mockUnauthorized('Bạn không thể tự vô hiệu hóa tài khoản đang đăng nhập.');
    }
    if (target.activation_required && input.active === true) {
      mockUnauthorized('Tài khoản đang chờ hoàn tất quy trình kích hoạt.');
    }
    const updated = { ...target, ...input };
    mockUsers = mockUsers.map((item, itemIndex) => itemIndex === index ? updated : item);
    return { ...updated };
  },
  async listRoleAccess() {
    const manager = requireMockManager();
    return (mockRoleAccess.get(manager.tenant_id!) ?? []).map((item) => ({
      ...item,
      permissions: [...item.permissions],
    }));
  },
  async updateRoleAccess(role, permissions) {
    const manager = requireMockManager();
    if (role === 'admin') {
      mockUnauthorized('Quyền nền tảng của quản lý khu vực được bảo vệ.');
    }
    const protectedPermissions = ['users.read', 'users.create', 'users.manage', 'roles.read', 'roles.manage'];
    if (permissions.some((permission) => protectedPermissions.includes(permission))) {
      mockUnauthorized('Quản trị người dùng và phân quyền chỉ dành cho Quản lý.');
    }
    const rows = mockRoleAccess.get(manager.tenant_id!) ?? [];
    const updated: RoleAccess = { role, label: 'Nhân viên tín dụng', permissions: [...new Set(permissions)] };
    mockRoleAccess.set(
      manager.tenant_id!,
      rows.map((item) => item.role === role ? updated : item),
    );
    return updated;
  },
  openEventSource(convId: string) {
    return createMockEventSource(convId);
  },
};

// wrap DOM EventSource → MinimalEventSource (bỏ event-arg, chỉ chuyển .data + tín hiệu open/error).
function browserEventSource(convId: string): MinimalEventSource {
  const src = new EventSource(`/api/conversations/${convId}/sse`, { withCredentials: true });
  const es: MinimalEventSource = {
    onopen: null,
    onmessage: null,
    onerror: null,
    close: () => src.close(),
  };
  src.onopen = () => es.onopen?.();
  // heartbeat backend = DATA-frame `data:{"type":"ping",...}` (event MẶC ĐỊNH, không named) → vào
  // onmessage như mọi event khác. Hook parse type==='ping' → reset watchdog + bỏ qua render. D-54.
  src.onmessage = (ev: MessageEvent) => es.onmessage?.({ data: String(ev.data) });
  src.onerror = () => es.onerror?.();
  return es;
}

const realApi: ConversationApi = {
  login: apiClient.login,
  logout: apiClient.logout,
  me: apiClient.me,
  listConversations: apiClient.listConversations,
  createConversation: apiClient.createConversation,
  getConversation: apiClient.getConversation,
  sendChat: apiClient.sendChat,
  decideApproval: apiClient.decideApproval,
  auditByConv: apiClient.auditByConv,
  auditByTask: apiClient.auditByTask,
  interruptTask: apiClient.interruptTask,
  listApprovals: apiClient.listApprovals,
  auditFiltered: apiClient.auditFiltered,
  getModels: apiClient.getModels,
  runCompare: apiClient.runCompare,
  listAccessUsers: apiClient.listAccessUsers,
  createAccessUser: apiClient.createAccessUser,
  updateAccessUser: apiClient.updateAccessUser,
  listRoleAccess: apiClient.listRoleAccess,
  updateRoleAccess: apiClient.updateRoleAccess,
  openEventSource: browserEventSource,
};

export const conversationApi: ConversationApi = USE_MOCK_API ? mockApi : realApi;
