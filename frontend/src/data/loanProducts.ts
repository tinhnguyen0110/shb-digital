import type { RegionCode, TenantId } from '../types';

export type LoanProductId =
  | 'unsecured-consumer'
  | 'public-service-unsecured'
  | 'online-overdraft';

export type LoanPurpose = 'everyday' | 'urgent' | 'public_service';
export type { RegionCode, TenantId } from '../types';

export interface LoanProduct {
  id: LoanProductId;
  name: string;
  purpose: LoanPurpose;
  summary: string;
  highlights: string[];
  limitLabel: string;
  termLabel: string;
  collateralLabel: string;
  sourceUrl: string;
  sourceCheckedAt: string;
  supportsQuickCheck: boolean;
}

export const SHB_LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'unsecured-consumer',
    name: 'Vay tiêu dùng không tài sản bảo đảm',
    purpose: 'everyday',
    summary: 'Khoản vay tín chấp cho các nhu cầu chi tiêu cá nhân và gia đình.',
    highlights: ['Hạn mức công bố đến 500 triệu đồng', 'Thời gian vay đến 60 tháng', 'Không cần tài sản bảo đảm'],
    limitLabel: 'Đến 500 triệu đồng',
    termLabel: 'Đến 60 tháng',
    collateralLabel: 'Không yêu cầu',
    sourceUrl: 'https://www.shb.com.vn/tin-chap-tieu-dung/',
    sourceCheckedAt: '2026-07-19',
    supportsQuickCheck: true,
  },
  {
    id: 'public-service-unsecured',
    name: 'Vay tín chấp dành cho cán bộ khu vực công',
    purpose: 'public_service',
    summary: 'Khoản vay tiêu dùng không tài sản bảo đảm dành cho cán bộ, công chức, viên chức và lực lượng vũ trang.',
    highlights: ['Hạn mức công bố đến 1,2 tỷ đồng', 'Thời gian vay đến 60 tháng', 'Không cần tài sản bảo đảm'],
    limitLabel: 'Đến 1,2 tỷ đồng',
    termLabel: 'Đến 60 tháng',
    collateralLabel: 'Không yêu cầu',
    sourceUrl: 'https://www.shb.com.vn/vay-tieu-dung-khong-tai-san-bao-dam-danh-cho-can-bo-cong-chuc-vien-chuc-luc-luong-vu-trang/',
    sourceCheckedAt: '2026-07-19',
    supportsQuickCheck: false,
  },
  {
    id: 'online-overdraft',
    name: 'Vay thấu chi online tín chấp',
    purpose: 'urgent',
    summary: 'Hạn mức chi tiêu linh hoạt dành cho khách hàng đủ điều kiện trên SHB Mobile.',
    highlights: ['Hạn mức công bố đến 1 tỷ đồng', 'Duy trì hạn mức 12 tháng', 'Đăng ký trên ứng dụng SHB Mobile'],
    limitLabel: 'Đến 1 tỷ đồng',
    termLabel: '12 tháng',
    collateralLabel: 'Không yêu cầu',
    sourceUrl: 'https://www.shb.com.vn/vay-thau-chi-online-tin-chap/',
    sourceCheckedAt: '2026-07-19',
    supportsQuickCheck: false,
  },
];

export interface CreditPolicy {
  id: string;
  tenantId: 'shb-retail';
  label: string;
  version: string;
  effectiveAt: string;
  evaluatedAt: string;
  quickCheckLimitVnd: number;
  minAge: number;
  maxAgeAtMaturity: number;
  minMonthlyIncomeVnd: number;
  maxDebtToIncome: number;
  evidenceMaxAgeDays: number;
  weights: {
    repaymentCapacity: number;
    incomeStability: number;
    paymentHistory: number;
  };
}

export const SMALL_UNSECURED_POLICY: CreditPolicy = {
  id: 'retail-national-small-unsecured',
  tenantId: 'shb-retail',
  label: 'Kiểm tra nhanh tín chấp toàn quốc',
  version: 'QCK-UNS-2026.07-01',
  effectiveAt: '2026-07-01',
  evaluatedAt: '2026-07-19',
  quickCheckLimitVnd: 10_000_000,
  minAge: 22,
  maxAgeAtMaturity: 70,
  minMonthlyIncomeVnd: 5_000_000,
  maxDebtToIncome: 0.5,
  evidenceMaxAgeDays: 30,
  weights: { repaymentCapacity: 45, incomeStability: 30, paymentHistory: 25 },
};

export interface RegionServiceConfig {
  id: string;
  tenantId: TenantId;
  region: RegionCode;
  label: string;
  version: string;
  effectiveAt: string;
  serviceSlaHours: number;
  productPriorities: LoanProductId[];
}

// Cấu hình theo vùng chỉ dùng để phân tuyến phục vụ và ưu tiên danh mục. Các ngưỡng tín dụng
// nằm trong SMALL_UNSECURED_POLICY dùng chung toàn quốc, tránh để địa lý tự thay đổi eligibility.
export const REGION_SERVICE_CONFIGS: Record<RegionCode, RegionServiceConfig> = {
  north: {
    id: 'retail-north-service',
    tenantId: 'shb-north',
    region: 'north',
    label: 'SHB Bán lẻ · Miền Bắc',
    version: 'SERVICE-2026.07-N1',
    effectiveAt: '2026-07-01',
    serviceSlaHours: 4,
    productPriorities: ['unsecured-consumer', 'public-service-unsecured', 'online-overdraft'],
  },
  central: {
    id: 'retail-central-service',
    tenantId: 'shb-central',
    region: 'central',
    label: 'SHB Bán lẻ · Miền Trung',
    version: 'SERVICE-2026.07-C1',
    effectiveAt: '2026-07-01',
    serviceSlaHours: 6,
    productPriorities: ['unsecured-consumer', 'online-overdraft', 'public-service-unsecured'],
  },
  south: {
    id: 'retail-south-service',
    tenantId: 'shb-south',
    region: 'south',
    label: 'SHB Bán lẻ · Miền Nam',
    version: 'SERVICE-2026.07-S1',
    effectiveAt: '2026-07-01',
    serviceSlaHours: 4,
    productPriorities: ['online-overdraft', 'unsecured-consumer', 'public-service-unsecured'],
  },
};

export type MockCicStatus = 'on_time' | 'late' | 'unavailable';

export interface MockCicEvidence {
  status: MockCicStatus;
  source: {
    provider: 'CIC_MOCK';
    contract: 'vn-cic-k11-normalized';
    schemaVersion: '1.0';
    requestId: string;
    recordAsOf: string;
    isMock: true;
    liveCall: false;
    dataClassification: 'synthetic_fixture';
    disclaimer: string;
  };
}

const MOCK_CIC_SOURCE = {
  provider: 'CIC_MOCK',
  contract: 'vn-cic-k11-normalized',
  schemaVersion: '1.0',
  recordAsOf: '2026-07-18',
  isMock: true,
  liveCall: false,
  dataClassification: 'synthetic_fixture',
  disclaimer: 'Dữ liệu tổng hợp chỉ dùng cho demo; không phải dữ liệu CIC thật.',
} as const;

export function createMockCicEvidence(status: MockCicStatus): MockCicEvidence {
  return {
    status,
    source: {
      ...MOCK_CIC_SOURCE,
      requestId: `CIC-MOCK-${status.toUpperCase()}-20260718`,
    },
  };
}

export interface PreliminaryCheckInput {
  productId: LoanProductId;
  amountVnd: number;
  termMonths: number;
  age: number;
  monthlyIncomeVnd: number;
  monthlyDebtVnd: number;
  cicEvidence: MockCicEvidence | null;
  employmentStable: boolean;
  region: RegionCode;
}

export type PreliminaryOutcome =
  | 'PRELIMINARY_ELIGIBLE'
  | 'PRELIMINARY_INELIGIBLE'
  | 'NEEDS_INFORMATION'
  | 'MANUAL_REVIEW'
  | 'OUT_OF_SCOPE';

export interface PreliminaryCheckResult {
  decisionKind: 'PRELIMINARY';
  outcome: PreliminaryOutcome;
  notApproval: true;
  reasonCodes: string[];
  reasons: string[];
  policy: Pick<CreditPolicy, 'id' | 'version' | 'effectiveAt' | 'label'>;
  servicing: Pick<RegionServiceConfig, 'id' | 'version' | 'label'> | null;
  debtToIncome: number | null;
  assessmentScore: number | null;
  evidence: {
    cic: MockCicEvidence['source'] | null;
  };
}

export function recommendProduct(purpose: LoanPurpose): LoanProduct {
  return SHB_LOAN_PRODUCTS.find((product) => product.purpose === purpose) ?? SHB_LOAN_PRODUCTS[0];
}

export function runPreliminaryCheck(input: PreliminaryCheckInput): PreliminaryCheckResult {
  const policy = SMALL_UNSECURED_POLICY;
  const policyRef = {
    id: policy.id,
    version: policy.version,
    effectiveAt: policy.effectiveAt,
    label: policy.label,
  };
  const servicingConfig = Object.hasOwn(REGION_SERVICE_CONFIGS, input.region)
    ? REGION_SERVICE_CONFIGS[input.region]
    : null;
  const servicing = servicingConfig
    ? { id: servicingConfig.id, version: servicingConfig.version, label: servicingConfig.label }
    : null;
  const cicSource = input.cicEvidence?.source ?? null;
  const result = (
    outcome: PreliminaryOutcome,
    reasonCodes: string[],
    reasons: string[],
    debtToIncome: number | null = null,
    assessmentScore: number | null = null,
  ): PreliminaryCheckResult => ({
    decisionKind: 'PRELIMINARY',
    outcome,
    notApproval: true,
    reasonCodes,
    reasons,
    policy: policyRef,
    servicing,
    debtToIncome,
    assessmentScore,
    evidence: { cic: cicSource },
  });

  // Phạm vi sản phẩm/số tiền phải được xác định trước dữ liệu thẩm định. Vì vậy đúng 10 triệu
  // luôn nằm ngoài quick check, kể cả khi các trường phụ còn thiếu.
  if (
    !Number.isFinite(input.amountVnd) ||
    !Number.isInteger(input.amountVnd) ||
    input.amountVnd <= 0
  ) {
    return result('NEEDS_INFORMATION', ['INVALID_AMOUNT'], ['Cần nhập số tiền vay hợp lệ.']);
  }
  if (input.amountVnd >= policy.quickCheckLimitVnd) {
    return result(
      'OUT_OF_SCOPE',
      ['AMOUNT_OUTSIDE_QUICK_CHECK_SCOPE'],
      ['Bạn có thể giảm số tiền kiểm tra hoặc để chuyên viên xem xét nhu cầu hiện tại.'],
    );
  }

  const product = SHB_LOAN_PRODUCTS.find((candidate) => candidate.id === input.productId);
  if (!product) {
    return result('NEEDS_INFORMATION', ['INVALID_PRODUCT'], ['Cần chọn một gói vay hợp lệ.']);
  }
  if (!product.supportsQuickCheck) {
    return result(
      'MANUAL_REVIEW',
      ['EMPLOYEE_REVIEW_REQUIRED'],
      ['Nhu cầu này cần chuyên viên xem xét thêm trước khi có kết quả.'],
    );
  }

  if (
    !Number.isFinite(input.monthlyIncomeVnd) ||
    !Number.isFinite(input.monthlyDebtVnd) ||
    !Number.isFinite(input.age) ||
    !Number.isFinite(input.termMonths) ||
    !Number.isInteger(input.age) ||
    !Number.isInteger(input.termMonths) ||
    input.monthlyIncomeVnd <= 0 ||
    input.monthlyDebtVnd < 0 ||
    input.age <= 0 ||
    input.termMonths <= 0 ||
    !servicingConfig
  ) {
    return result(
      'NEEDS_INFORMATION',
      ['INVALID_REQUIRED_INFORMATION'],
      ['Cần kiểm tra lại tuổi, thời hạn vay, thu nhập, nghĩa vụ trả nợ và khu vực hỗ trợ.'],
    );
  }

  if (!isValidMockCicEvidence(input.cicEvidence)) {
    return result(
      'NEEDS_INFORMATION',
      ['CIC_MOCK_EVIDENCE_MISSING'],
      ['Chưa có đủ dữ liệu minh họa về lịch sử thanh toán để kiểm tra.'],
    );
  }
  if (isEvidenceStale(input.cicEvidence.source.recordAsOf, policy.evaluatedAt, policy.evidenceMaxAgeDays)) {
    return result(
      'NEEDS_INFORMATION',
      ['CIC_MOCK_EVIDENCE_STALE'],
      ['Dữ liệu minh họa về lịch sử thanh toán cần được cập nhật.'],
    );
  }
  if (input.cicEvidence.status === 'unavailable') {
    return result(
      'NEEDS_INFORMATION',
      ['CIC_MOCK_EVIDENCE_UNAVAILABLE'],
      ['Chưa có đủ dữ liệu minh họa về lịch sử thanh toán để kiểm tra.'],
    );
  }

  const estimatedPrincipalPayment = input.amountVnd / input.termMonths;
  const debtToIncome = (input.monthlyDebtVnd + estimatedPrincipalPayment) / input.monthlyIncomeVnd;
  const hardFailures: string[] = [];
  const hardFailureReasons: string[] = [];
  const reviewFlags: string[] = [];
  const reviewReasons: string[] = [];

  if (input.age < policy.minAge || input.age + input.termMonths / 12 > policy.maxAgeAtMaturity) {
    hardFailures.push('AGE_OUTSIDE_POLICY');
    hardFailureReasons.push('Độ tuổi hiện chưa phù hợp với điều kiện sơ bộ của gói vay.');
  }
  if (input.monthlyIncomeVnd < policy.minMonthlyIncomeVnd) {
    hardFailures.push('INCOME_BELOW_POLICY');
    hardFailureReasons.push('Thu nhập khai báo chưa đạt mức tối thiểu của điều kiện sơ bộ.');
  }
  if (debtToIncome > policy.maxDebtToIncome) {
    hardFailures.push('PAYMENT_CAPACITY_OUTSIDE_POLICY');
    hardFailureReasons.push('Tổng nghĩa vụ trả nợ dự kiến đang cao so với thu nhập khai báo.');
  }
  if (input.cicEvidence.status === 'late') {
    reviewFlags.push('PAYMENT_HISTORY_REVIEW');
    reviewReasons.push('Lịch sử thanh toán minh họa cần được chuyên viên xem xét.');
  }
  if (!input.employmentStable) {
    reviewFlags.push('INCOME_STABILITY_REVIEW');
    reviewReasons.push('Nguồn thu nhập cần thêm thông tin để đánh giá mức độ ổn định.');
  }

  const assessmentScore = calculateAssessmentScore(
    debtToIncome,
    input.employmentStable,
    input.cicEvidence.status,
    policy,
  );

  if (hardFailures.length > 0) {
    return result(
      'PRELIMINARY_INELIGIBLE',
      [...hardFailures, ...reviewFlags],
      [...hardFailureReasons, ...reviewReasons],
      debtToIncome,
      assessmentScore,
    );
  }
  if (reviewFlags.length > 0) {
    return result('MANUAL_REVIEW', reviewFlags, reviewReasons, debtToIncome, assessmentScore);
  }

  return result(
    'PRELIMINARY_ELIGIBLE',
    ['AMOUNT_IN_QUICK_CHECK_SCOPE', 'PAYMENT_CAPACITY_IN_POLICY', 'PAYMENT_HISTORY_MOCK_ON_TIME'],
    [
      'Số tiền vay nằm trong phạm vi kiểm tra nhanh.',
      'Khả năng trả nợ dự kiến phù hợp với thông tin thu nhập đã khai báo.',
      'Lịch sử thanh toán trong dữ liệu minh họa không có tín hiệu cần xem xét.',
    ],
    debtToIncome,
    assessmentScore,
  );
}

function isValidMockCicEvidence(evidence: MockCicEvidence | null): evidence is MockCicEvidence {
  if (!evidence) return false;
  return (
    ['on_time', 'late', 'unavailable'].includes(evidence.status) &&
    evidence.source.provider === 'CIC_MOCK' &&
    evidence.source.contract === 'vn-cic-k11-normalized' &&
    evidence.source.schemaVersion === '1.0' &&
    evidence.source.isMock === true &&
    evidence.source.liveCall === false &&
    evidence.source.dataClassification === 'synthetic_fixture' &&
    Boolean(evidence.source.requestId) &&
    Number.isFinite(Date.parse(evidence.source.recordAsOf))
  );
}

function isEvidenceStale(recordAsOf: string, evaluatedAt: string, maxAgeDays: number): boolean {
  const elapsedMs = Date.parse(evaluatedAt) - Date.parse(recordAsOf);
  return elapsedMs < 0 || elapsedMs > maxAgeDays * 86_400_000;
}

function calculateAssessmentScore(
  debtToIncome: number,
  employmentStable: boolean,
  cicStatus: MockCicStatus,
  policy: CreditPolicy,
): number {
  const repaymentCapacity = clamp((1 - debtToIncome / policy.maxDebtToIncome) * 100);
  const incomeStability = employmentStable ? 100 : 45;
  const paymentHistory = cicStatus === 'on_time' ? 100 : cicStatus === 'late' ? 45 : 0;
  return Math.round(
    (repaymentCapacity * policy.weights.repaymentCapacity +
      incomeStability * policy.weights.incomeStability +
      paymentHistory * policy.weights.paymentHistory) /
      100,
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
