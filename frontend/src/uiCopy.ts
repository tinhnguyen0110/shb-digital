import type { AuthUser } from './types';

const USER_ROLE_LABEL: Record<AuthUser['role'], string> = {
  customer: 'Khách vay',
  user: 'Nhân viên tín dụng',
  admin: 'Giám đốc chi nhánh',
};

const PROVIDER_LABEL: Record<string, string> = {
  'claude-cli': 'Phương án tiêu chuẩn',
  zai: 'Phương án dự phòng',
  openai: 'Phương án mở rộng',
};

const MODEL_LABEL: Record<string, string> = {
  haiku: 'Nhanh',
  sonnet: 'Cân bằng',
  opus: 'Chuyên sâu',
  'glm-4.6': 'Cân bằng',
  'glm-4.5': 'Ổn định',
  'gpt-4': 'Tiêu chuẩn',
};

const ACTIVITY_LABEL: Record<string, string> = {
  orch_dispatch: 'Chuyển nội dung đến bộ phận phụ trách',
  credit_assess: 'Đánh giá thông tin tín dụng',
  credit_cic_get: 'Đối chiếu thông tin tín dụng',
  cust_get: 'Đối chiếu thông tin khách hàng',
  cic_get: 'Đối chiếu thông tin tín dụng',
  c06_get: 'Đối chiếu thông tin định danh',
  bhxh_get: 'Đối chiếu thông tin việc làm và bảo hiểm',
  product_search: 'Tra cứu chính sách sản phẩm',
  legal_review: 'Rà soát yêu cầu pháp lý',
};

const SOURCE_LABEL: Record<string, string> = {
  credit_assess: 'Kết quả thẩm định tín dụng',
  credit_cic_get: 'Thông tin tín dụng',
  cust_get: 'Thông tin khách hàng',
  cic_get: 'Thông tin tín dụng',
  c06_get: 'Thông tin định danh',
  bhxh_get: 'Thông tin việc làm và bảo hiểm',
  product_search: 'Chính sách sản phẩm',
  legal_review: 'Kết quả rà soát pháp lý',
};

const APPROVAL_ACTION_LABEL: Record<string, string> = {
  disburse: 'Phê duyệt giải ngân',
  approve_loan: 'Phê duyệt khoản vay',
  counter_offer: 'Phê duyệt đề xuất điều chỉnh',
  request_information: 'Yêu cầu bổ sung thông tin',
};

export function userRoleLabel(role: AuthUser['role']): string {
  return USER_ROLE_LABEL[role];
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? 'Phương án khác';
}

export function modelLabel(model: string): string {
  return MODEL_LABEL[model] ?? 'Theo cấu hình hệ thống';
}

export function activityLabel(activity: string): string {
  return ACTIVITY_LABEL[activity] ?? 'Ghi nhận hoạt động nghiệp vụ';
}

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? 'Nguồn thông tin nghiệp vụ';
}

export function approvalActionLabel(action: string): string {
  const normalized = action.trim().toLowerCase();
  if (normalized.includes('giải ngân') || normalized.includes('disburse')) {
    return 'Phê duyệt giải ngân';
  }
  return APPROVAL_ACTION_LABEL[action] ?? 'Yêu cầu phê duyệt';
}
