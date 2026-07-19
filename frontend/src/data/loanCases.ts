import type { Conversation, ConversationStatus, TenantId } from '../types';
import type { LoanProductId, RegionCode } from './loanProducts';

export interface DemoLoanCase {
  conversation: Conversation;
  applicationCode: string;
  customerName: string;
  productId: LoanProductId;
  productName: string;
  amountVnd: number;
  termMonths: number;
  tenantId: TenantId;
  region: RegionCode;
  unitName: string;
  ownerName: string;
  policyVersion: string;
  serviceConfigVersion: string;
  recommendation: 'continue' | 'approve_review' | 'need_information' | 'not_suitable';
  recommendationLabel: string;
  decisionRoute: 'auto_approved' | 'staff_reassessment' | 'branch_manager_review';
  customerDataVerified: boolean;
  seriousIssues: string[];
  policyScore: number;
  monthlyIncomeVnd: number;
  monthlyDebtVnd: number;
  debtToIncome: number;
  paymentHistory: string;
  strengths: string[];
  attentionPoints: string[];
  receivedDocuments: string[];
  timeline: Array<{ label: string; at: string; state: 'done' | 'current' | 'pending' }>;
}

export interface CaseAttachment {
  id: string;
  title: string;
  fileName: string;
  sizeLabel: string;
  verification: 'verified' | 'needs_review';
}

const ATTACHMENT_FILE_NAMES: Record<string, string> = {
  'Giấy tờ định danh': 'giay-to-dinh-danh.pdf',
  'Chứng minh thu nhập': 'chung-minh-thu-nhap.pdf',
  'Đề nghị vay vốn': 'de-nghi-vay-von.pdf',
  'Xác nhận công tác': 'xac-nhan-cong-tac.pdf',
};

export function caseAttachments(loanCase: DemoLoanCase): CaseAttachment[] {
  return loanCase.receivedDocuments.map((title, index) => ({
    id: `${loanCase.applicationCode}-${index + 1}`,
    title,
    fileName: `${loanCase.applicationCode}_${ATTACHMENT_FILE_NAMES[title] ?? `tai-lieu-${index + 1}.pdf`}`,
    sizeLabel: `${(0.8 + index * 0.35).toFixed(1)} MB`,
    verification:
      loanCase.customerDataVerified && !loanCase.seriousIssues.some((issue) => issue.includes(title))
        ? 'verified'
        : 'needs_review',
  }));
}

export function needsStaffReassessment(loanCase: DemoLoanCase): boolean {
  return loanCase.decisionRoute === 'staff_reassessment';
}

export const DEMO_LOAN_CASES: DemoLoanCase[] = [
  {
    conversation: {
      id: 'demo_hs_north_01',
      tenant_id: 'shb-north',
      title: 'Nguyễn Minh Anh · Vay tiêu dùng tín chấp',
      status: 'done',
      created_at: '2026-07-18T08:20:00+07:00',
    },
    applicationCode: 'SHB-HN-260718-001',
    customerName: 'Nguyễn Minh Anh',
    productId: 'unsecured-consumer',
    productName: 'Vay tiêu dùng không tài sản bảo đảm',
    amountVnd: 8_000_000,
    termMonths: 12,
    tenantId: 'shb-north',
    region: 'north',
    unitName: 'SHB Bán lẻ · Miền Bắc',
    ownerName: 'Trần Thu Hà',
    policyVersion: 'QCK-UNS-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-N1',
    recommendation: 'continue',
    recommendationLabel: 'Đã tự động phê duyệt',
    decisionRoute: 'auto_approved',
    customerDataVerified: true,
    seriousIssues: [],
    policyScore: 86,
    monthlyIncomeVnd: 18_000_000,
    monthlyDebtVnd: 2_000_000,
    debtToIncome: 0.18,
    paymentHistory: 'Thanh toán đúng hạn trong dữ liệu minh họa',
    strengths: ['Thu nhập khai báo ổn định', 'Nghĩa vụ trả nợ trong ngưỡng xem xét', 'Lịch sử thanh toán phù hợp'],
    attentionPoints: [],
    receivedDocuments: ['Giấy tờ định danh', 'Chứng minh thu nhập', 'Đề nghị vay vốn'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '18/07/2026 · 08:20', state: 'done' },
      { label: 'Kiểm tra thông tin', at: '18/07/2026 · 09:05', state: 'done' },
      { label: 'Đánh giá tự động', at: '18/07/2026 · 09:06', state: 'done' },
      { label: 'Tự động phê duyệt', at: '18/07/2026 · 09:07', state: 'done' },
    ],
  },
  {
    conversation: {
      id: 'demo_hs_north_02',
      tenant_id: 'shb-north',
      title: 'Phạm Thu Hương · Tín chấp cán bộ khu vực công',
      status: 'waiting_approval',
      created_at: '2026-07-17T14:10:00+07:00',
    },
    applicationCode: 'SHB-HN-260717-014',
    customerName: 'Phạm Thu Hương',
    productId: 'public-service-unsecured',
    productName: 'Vay tín chấp dành cho cán bộ khu vực công',
    amountVnd: 180_000_000,
    termMonths: 36,
    tenantId: 'shb-north',
    region: 'north',
    unitName: 'SHB Bán lẻ · Miền Bắc',
    ownerName: 'Trần Thu Hà',
    policyVersion: 'UNSEC-PS-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-N1',
    recommendation: 'approve_review',
    recommendationLabel: 'Chờ giám đốc chi nhánh xác nhận',
    decisionRoute: 'branch_manager_review',
    customerDataVerified: true,
    seriousIssues: ['Khoản vay có ngoại lệ cần người có thẩm quyền xác nhận'],
    policyScore: 82,
    monthlyIncomeVnd: 28_000_000,
    monthlyDebtVnd: 4_000_000,
    debtToIncome: 0.36,
    paymentHistory: 'Không ghi nhận chậm trả trong dữ liệu minh họa',
    strengths: ['Nguồn thu nhập ổn định', 'Lịch sử thanh toán phù hợp', 'Hồ sơ nghề nghiệp rõ ràng'],
    attentionPoints: ['Khoản vay cần người có thẩm quyền xem xét'],
    receivedDocuments: ['Giấy tờ định danh', 'Chứng minh thu nhập', 'Xác nhận công tác'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '17/07/2026 · 14:10', state: 'done' },
      { label: 'Kiểm tra thông tin', at: '17/07/2026 · 15:25', state: 'done' },
      { label: 'Đánh giá khả năng trả nợ', at: '18/07/2026 · 10:15', state: 'done' },
      { label: 'Quản lý xem xét', at: 'Đang chờ quyết định', state: 'current' },
    ],
  },
  {
    conversation: {
      id: 'demo_hs_central_01',
      tenant_id: 'shb-central',
      title: 'Trần Hoàng Nam · Vay tiêu dùng tín chấp',
      status: 'done',
      created_at: '2026-07-16T09:35:00+07:00',
    },
    applicationCode: 'SHB-DN-260716-008',
    customerName: 'Trần Hoàng Nam',
    productId: 'unsecured-consumer',
    productName: 'Vay tiêu dùng không tài sản bảo đảm',
    amountVnd: 75_000_000,
    termMonths: 24,
    tenantId: 'shb-central',
    region: 'central',
    unitName: 'SHB Bán lẻ · Miền Trung',
    ownerName: 'Nguyễn Hải Yến',
    policyVersion: 'UNSEC-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-C1',
    recommendation: 'continue',
    recommendationLabel: 'Đã có kết quả',
    decisionRoute: 'auto_approved',
    customerDataVerified: true,
    seriousIssues: [],
    policyScore: 88,
    monthlyIncomeVnd: 24_000_000,
    monthlyDebtVnd: 3_000_000,
    debtToIncome: 0.31,
    paymentHistory: 'Thanh toán đúng hạn trong dữ liệu minh họa',
    strengths: ['Khả năng trả nợ phù hợp', 'Thu nhập khai báo ổn định', 'Hồ sơ đầy đủ'],
    attentionPoints: [],
    receivedDocuments: ['Giấy tờ định danh', 'Chứng minh thu nhập', 'Đề nghị vay vốn'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '16/07/2026 · 09:35', state: 'done' },
      { label: 'Kiểm tra thông tin', at: '16/07/2026 · 10:12', state: 'done' },
      { label: 'Đánh giá khả năng trả nợ', at: '16/07/2026 · 14:40', state: 'done' },
      { label: 'Thông báo kết quả', at: '16/07/2026 · 16:05', state: 'done' },
    ],
  },
  {
    conversation: {
      id: 'demo_hs_central_02',
      tenant_id: 'shb-central',
      title: 'Võ Minh Châu · Thấu chi online tín chấp',
      status: 'idle',
      created_at: '2026-07-15T16:45:00+07:00',
    },
    applicationCode: 'SHB-DN-260715-021',
    customerName: 'Võ Minh Châu',
    productId: 'online-overdraft',
    productName: 'Vay thấu chi online tín chấp',
    amountVnd: 30_000_000,
    termMonths: 12,
    tenantId: 'shb-central',
    region: 'central',
    unitName: 'SHB Bán lẻ · Miền Trung',
    ownerName: 'Nguyễn Hải Yến',
    policyVersion: 'OD-UNSEC-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-C1',
    recommendation: 'need_information',
    recommendationLabel: 'Cần nhân viên đánh giá lại',
    decisionRoute: 'staff_reassessment',
    customerDataVerified: false,
    seriousIssues: ['Chứng minh thu nhập chưa được xác thực'],
    policyScore: 61,
    monthlyIncomeVnd: 16_000_000,
    monthlyDebtVnd: 3_500_000,
    debtToIncome: 0.43,
    paymentHistory: 'Chưa đủ thông tin để kết luận',
    strengths: ['Khách hàng đang sử dụng SHB Mobile'],
    attentionPoints: ['Cần bổ sung chứng minh thu nhập', 'Cần làm rõ nghĩa vụ trả nợ hiện tại'],
    receivedDocuments: ['Giấy tờ định danh'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '15/07/2026 · 16:45', state: 'done' },
      { label: 'Bổ sung thông tin', at: 'Đang chờ khách hàng', state: 'current' },
      { label: 'Đánh giá khả năng trả nợ', at: 'Chưa thực hiện', state: 'pending' },
      { label: 'Thông báo kết quả', at: 'Chưa thực hiện', state: 'pending' },
    ],
  },
  {
    conversation: {
      id: 'demo_hs_south_01',
      tenant_id: 'shb-south',
      title: 'Lê Thu Trang · Vay tiêu dùng tín chấp',
      status: 'failed',
      created_at: '2026-07-14T11:05:00+07:00',
    },
    applicationCode: 'SHB-HCM-260714-033',
    customerName: 'Lê Thu Trang',
    productId: 'unsecured-consumer',
    productName: 'Vay tiêu dùng không tài sản bảo đảm',
    amountVnd: 80_000_000,
    termMonths: 24,
    tenantId: 'shb-south',
    region: 'south',
    unitName: 'SHB Bán lẻ · Miền Nam',
    ownerName: 'Lê Minh Quân',
    policyVersion: 'UNSEC-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-S1',
    recommendation: 'not_suitable',
    recommendationLabel: 'Cần nhân viên đánh giá lại',
    decisionRoute: 'staff_reassessment',
    customerDataVerified: true,
    seriousIssues: ['Điểm chính sách dưới ngưỡng tự động phê duyệt'],
    policyScore: 44,
    monthlyIncomeVnd: 12_000_000,
    monthlyDebtVnd: 6_500_000,
    debtToIncome: 0.71,
    paymentHistory: 'Có kỳ thanh toán chậm trong dữ liệu minh họa',
    strengths: ['Thông tin định danh đầy đủ'],
    attentionPoints: ['Nghĩa vụ trả nợ hiện tại cao', 'Lịch sử thanh toán cần làm rõ'],
    receivedDocuments: ['Giấy tờ định danh', 'Chứng minh thu nhập'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '14/07/2026 · 11:05', state: 'done' },
      { label: 'Kiểm tra thông tin', at: '14/07/2026 · 11:42', state: 'done' },
      { label: 'Yêu cầu bổ sung', at: '14/07/2026 · 15:18', state: 'current' },
      { label: 'Thông báo kết quả', at: 'Chưa thực hiện', state: 'pending' },
    ],
  },
  {
    conversation: {
      id: 'demo_hs_south_02',
      tenant_id: 'shb-south',
      title: 'Nguyễn Quốc Bảo · Thấu chi online tín chấp',
      status: 'running',
      created_at: '2026-07-13T13:40:00+07:00',
    },
    applicationCode: 'SHB-HCM-260713-041',
    customerName: 'Nguyễn Quốc Bảo',
    productId: 'online-overdraft',
    productName: 'Vay thấu chi online tín chấp',
    amountVnd: 150_000_000,
    termMonths: 12,
    tenantId: 'shb-south',
    region: 'south',
    unitName: 'SHB Bán lẻ · Miền Nam',
    ownerName: 'Lê Minh Quân',
    policyVersion: 'OD-UNSEC-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-S1',
    recommendation: 'continue',
    recommendationLabel: 'Chờ giám đốc chi nhánh xác nhận',
    decisionRoute: 'branch_manager_review',
    customerDataVerified: true,
    seriousIssues: ['Hạn mức đề nghị cần người có thẩm quyền xác nhận'],
    policyScore: 79,
    monthlyIncomeVnd: 35_000_000,
    monthlyDebtVnd: 5_000_000,
    debtToIncome: 0.39,
    paymentHistory: 'Thanh toán đúng hạn trong dữ liệu minh họa',
    strengths: ['Khách hàng đang sử dụng SHB Mobile', 'Thu nhập khai báo ổn định'],
    attentionPoints: ['Cần xác nhận hạn mức được đề nghị'],
    receivedDocuments: ['Giấy tờ định danh', 'Chứng minh thu nhập'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '13/07/2026 · 13:40', state: 'done' },
      { label: 'Kiểm tra thông tin', at: '13/07/2026 · 14:25', state: 'done' },
      { label: 'Đánh giá khả năng trả nợ', at: 'Đang thực hiện', state: 'current' },
      { label: 'Thông báo kết quả', at: 'Chưa thực hiện', state: 'pending' },
    ],
  },
  {
    conversation: {
      id: 'demo_hs_north_03',
      tenant_id: 'shb-north',
      title: 'Đỗ Quang Huy · Vay tiêu dùng tín chấp',
      status: 'failed',
      created_at: '2026-07-16T10:30:00+07:00',
    },
    applicationCode: 'SHB-HN-260716-019',
    customerName: 'Đỗ Quang Huy',
    productId: 'unsecured-consumer',
    productName: 'Vay tiêu dùng không tài sản bảo đảm',
    amountVnd: 65_000_000,
    termMonths: 24,
    tenantId: 'shb-north',
    region: 'north',
    unitName: 'SHB Bán lẻ · Miền Bắc',
    ownerName: 'Nguyễn Hoài An',
    policyVersion: 'UNSEC-2026.07-01',
    serviceConfigVersion: 'SERVICE-2026.07-N1',
    recommendation: 'not_suitable',
    recommendationLabel: 'Cần nhân viên đánh giá lại',
    decisionRoute: 'staff_reassessment',
    customerDataVerified: true,
    seriousIssues: ['Điểm chính sách dưới ngưỡng tự động phê duyệt', 'Lịch sử thanh toán có sai lệch nghiêm trọng'],
    policyScore: 49,
    monthlyIncomeVnd: 14_000_000,
    monthlyDebtVnd: 7_000_000,
    debtToIncome: 0.68,
    paymentHistory: 'Có dữ liệu chậm trả cần nhân viên xác minh lại',
    strengths: ['Thông tin định danh đã được xác thực'],
    attentionPoints: ['Nghĩa vụ trả nợ hiện tại cao', 'Lịch sử thanh toán có sai lệch cần xác minh'],
    receivedDocuments: ['Giấy tờ định danh', 'Chứng minh thu nhập', 'Đề nghị vay vốn'],
    timeline: [
      { label: 'Tiếp nhận hồ sơ', at: '16/07/2026 · 10:30', state: 'done' },
      { label: 'Xác thực dữ liệu khách hàng', at: '16/07/2026 · 10:42', state: 'done' },
      { label: 'Phát hiện điều kiện ngoại lệ', at: '16/07/2026 · 10:45', state: 'done' },
      { label: 'Nhân viên đánh giá lại', at: 'Đang chờ xử lý', state: 'current' },
    ],
  },
];

export function caseStatusCount(status: ConversationStatus): number {
  return DEMO_LOAN_CASES.filter((item) => item.conversation.status === status).length;
}
