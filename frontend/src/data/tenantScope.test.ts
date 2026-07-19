import { describe, expect, it } from 'vitest';
import type { RegionCode, TenantId } from '../types';
import { DEMO_LOAN_CASES } from './loanCases';
import {
  createMockCicEvidence,
  REGION_SERVICE_CONFIGS,
  runPreliminaryCheck,
  SHB_LOAN_PRODUCTS,
  type LoanProductId,
  type PreliminaryCheckInput,
} from './loanProducts';

const ALLOWED_UNSECURED_PRODUCT_IDS = [
  'unsecured-consumer',
  'public-service-unsecured',
  'online-overdraft',
] as const satisfies readonly LoanProductId[];

const ALLOWED_INDIVIDUAL_PURPOSES = new Set(['everyday', 'urgent', 'public_service']);
const EXPECTED_TENANTS = new Set<TenantId>(['shb-north', 'shb-central', 'shb-south']);

function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

describe('unsecured regional tenant data contract', () => {
  it('keeps the catalog restricted to the three allowed unsecured products', () => {
    expect(SHB_LOAN_PRODUCTS.map((product) => product.id).toSorted()).toEqual(
      [...ALLOWED_UNSECURED_PRODUCT_IDS].toSorted(),
    );

    for (const product of SHB_LOAN_PRODUCTS) {
      expect(foldVietnamese(product.collateralLabel)).toMatch(/khong.*yeu cau/);
      expect(ALLOWED_INDIVIDUAL_PURPOSES.has(product.purpose)).toBe(true);

      const productText = foldVietnamese(
        [product.id, product.purpose, product.name, product.summary].join(' '),
      );
      expect(productText).not.toMatch(
        /\b(home-project|vay mua nha|vay mua o to|san xuat kinh doanh|the chap)\b/,
      );
    }
  });

  it('keeps every demo case tenant-scoped and linked to an individual unsecured product', () => {
    const productsById = new Map(SHB_LOAN_PRODUCTS.map((product) => [product.id, product]));

    for (const loanCase of DEMO_LOAN_CASES) {
      expect(loanCase.conversation.tenant_id).toBe(loanCase.tenantId);
      expect(EXPECTED_TENANTS.has(loanCase.tenantId)).toBe(true);

      const product = productsById.get(loanCase.productId);
      expect(product, `Missing product FK for ${loanCase.applicationCode}`).toBeDefined();
      expect(ALLOWED_UNSECURED_PRODUCT_IDS).toContain(loanCase.productId);
      expect(ALLOWED_INDIVIDUAL_PURPOSES.has(product!.purpose)).toBe(true);
      expect(foldVietnamese(product!.collateralLabel)).toMatch(/khong.*yeu cau/);
    }
  });

  it('has representative cases in every tenant and globally unique application codes', () => {
    const counts = new Map<TenantId, number>();
    for (const loanCase of DEMO_LOAN_CASES) {
      counts.set(loanCase.tenantId, (counts.get(loanCase.tenantId) ?? 0) + 1);
    }

    expect(new Set(counts.keys())).toEqual(EXPECTED_TENANTS);
    for (const tenantId of EXPECTED_TENANTS) {
      expect(counts.get(tenantId), `Missing representative cases for ${tenantId}`).toBeGreaterThanOrEqual(2);
    }

    const applicationCodes = DEMO_LOAN_CASES.map((loanCase) => loanCase.applicationCode);
    expect(new Set(applicationCodes).size).toBe(applicationCodes.length);
  });

  it('keeps every regional priority resolvable and unsecured-only', () => {
    const productsById = new Map(SHB_LOAN_PRODUCTS.map((product) => [product.id, product]));

    for (const [region, config] of Object.entries(REGION_SERVICE_CONFIGS)) {
      expect(config.region).toBe(region);
      expect(config.tenantId).toBe(`shb-${region}`);

      for (const productId of config.productPriorities) {
        const product = productsById.get(productId);
        expect(product, `Missing ${region} priority product ${productId}`).toBeDefined();
        expect(ALLOWED_UNSECURED_PRODUCT_IDS).toContain(productId);
        expect(foldVietnamese(product!.collateralLabel)).toMatch(/khong.*yeu cau/);
      }
    }
  });

  it('keeps the deterministic credit outcome identical across service regions', () => {
    const baseInput: Omit<PreliminaryCheckInput, 'region'> = {
      productId: 'unsecured-consumer',
      amountVnd: 8_000_000,
      termMonths: 12,
      age: 30,
      monthlyIncomeVnd: 15_000_000,
      monthlyDebtVnd: 2_000_000,
      cicEvidence: createMockCicEvidence('on_time'),
      employmentStable: true,
    };
    const regions: RegionCode[] = ['north', 'central', 'south'];
    const outcomes = regions.map((region) => runPreliminaryCheck({ ...baseInput, region }));
    const creditProjection = (result: (typeof outcomes)[number]) => ({
      outcome: result.outcome,
      reasonCodes: result.reasonCodes,
      debtToIncome: result.debtToIncome,
      assessmentScore: result.assessmentScore,
      policy: result.policy,
    });

    expect(creditProjection(outcomes[1])).toEqual(creditProjection(outcomes[0]));
    expect(creditProjection(outcomes[2])).toEqual(creditProjection(outcomes[0]));
  });

  it('keeps exactly ten million outside the quick-check boundary', () => {
    const result = runPreliminaryCheck({
      productId: 'unsecured-consumer',
      amountVnd: 10_000_000,
      termMonths: 12,
      age: 30,
      monthlyIncomeVnd: 15_000_000,
      monthlyDebtVnd: 2_000_000,
      cicEvidence: null,
      employmentStable: true,
      region: 'north',
    });

    expect(result.outcome).toBe('OUT_OF_SCOPE');
    expect(result.reasonCodes).toContain('AMOUNT_OUTSIDE_QUICK_CHECK_SCOPE');
  });
});
