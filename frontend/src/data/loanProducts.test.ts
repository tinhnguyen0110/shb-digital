import { describe, expect, it } from 'vitest';
import {
  createMockCicEvidence,
  runPreliminaryCheck,
  type MockCicEvidence,
  type PreliminaryCheckInput,
} from './loanProducts';

const VALID_INPUT: PreliminaryCheckInput = {
  productId: 'unsecured-consumer',
  amountVnd: 8_000_000,
  termMonths: 12,
  age: 30,
  monthlyIncomeVnd: 15_000_000,
  monthlyDebtVnd: 2_000_000,
  cicEvidence: createMockCicEvidence('on_time'),
  employmentStable: true,
  region: 'north',
};

describe('preliminary small unsecured decision', () => {
  it('returns preliminary eligible below 10 million without claiming approval', () => {
    const result = runPreliminaryCheck(VALID_INPUT);
    expect(result.outcome).toBe('PRELIMINARY_ELIGIBLE');
    expect(result.notApproval).toBe(true);
    expect(result.evidence.cic).toMatchObject({
      provider: 'CIC_MOCK',
      contract: 'vn-cic-k11-normalized',
      schemaVersion: '1.0',
      isMock: true,
      liveCall: false,
      dataClassification: 'synthetic_fixture',
    });
  });

  it('routes exactly 10 million out of scope before checking ancillary evidence', () => {
    expect(runPreliminaryCheck({ ...VALID_INPUT, amountVnd: 10_000_000, cicEvidence: null }).outcome).toBe(
      'OUT_OF_SCOPE',
    );
    expect(runPreliminaryCheck({ ...VALID_INPUT, amountVnd: 9_999_999 }).outcome).toBe(
      'PRELIMINARY_ELIGIBLE',
    );
  });

  it('rejects products outside the unsecured catalog', () => {
    const result = runPreliminaryCheck({
      ...VALID_INPUT,
      productId: 'home-project' as PreliminaryCheckInput['productId'],
    });
    expect(result.outcome).toBe('NEEDS_INFORMATION');
    expect(result.reasonCodes).toContain('INVALID_PRODUCT');
  });

  it('fails deterministically when payment capacity is outside policy', () => {
    const result = runPreliminaryCheck({ ...VALID_INPUT, monthlyIncomeVnd: 5_000_000, monthlyDebtVnd: 4_000_000 });
    expect(result.outcome).toBe('PRELIMINARY_INELIGIBLE');
    expect(result.reasonCodes).toContain('PAYMENT_CAPACITY_OUTSIDE_POLICY');
  });

  it('routes caution signals to review instead of treating them as a decline', () => {
    expect(
      runPreliminaryCheck({ ...VALID_INPUT, cicEvidence: createMockCicEvidence('late') }).outcome,
    ).toBe('MANUAL_REVIEW');
    expect(runPreliminaryCheck({ ...VALID_INPUT, employmentStable: false }).outcome).toBe(
      'MANUAL_REVIEW',
    );
  });

  it('asks for missing, unavailable or stale mock CIC evidence instead of guessing', () => {
    expect(runPreliminaryCheck({ ...VALID_INPUT, cicEvidence: null }).outcome).toBe('NEEDS_INFORMATION');
    expect(
      runPreliminaryCheck({
        ...VALID_INPUT,
        cicEvidence: createMockCicEvidence('unavailable'),
      }).outcome,
    ).toBe('NEEDS_INFORMATION');

    const staleEvidence: MockCicEvidence = {
      ...createMockCicEvidence('on_time'),
      source: {
        ...createMockCicEvidence('on_time').source,
        recordAsOf: '2026-01-01',
      },
    };
    const stale = runPreliminaryCheck({ ...VALID_INPUT, cicEvidence: staleEvidence });
    expect(stale.outcome).toBe('NEEDS_INFORMATION');
    expect(stale.reasonCodes).toContain('CIC_MOCK_EVIDENCE_STALE');
  });

  it('validates negative debt, invalid term and unknown region without throwing', () => {
    expect(runPreliminaryCheck({ ...VALID_INPUT, monthlyDebtVnd: -1 }).outcome).toBe(
      'NEEDS_INFORMATION',
    );
    expect(runPreliminaryCheck({ ...VALID_INPUT, termMonths: Number.POSITIVE_INFINITY }).outcome).toBe(
      'NEEDS_INFORMATION',
    );
    expect(
      runPreliminaryCheck({
        ...VALID_INPUT,
        region: 'unknown' as PreliminaryCheckInput['region'],
      }).outcome,
    ).toBe('NEEDS_INFORMATION');
  });

  it('keeps credit outcome invariant across service regions', () => {
    const results = (['north', 'central', 'south'] as const).map((region) =>
      runPreliminaryCheck({ ...VALID_INPUT, region }),
    );
    for (const candidate of results.slice(1)) {
      expect(candidate.outcome).toBe(results[0].outcome);
      expect(candidate.reasonCodes).toEqual(results[0].reasonCodes);
      expect(candidate.debtToIncome).toBe(results[0].debtToIncome);
      expect(candidate.assessmentScore).toBe(results[0].assessmentScore);
    }
  });

  it('is deterministic for the same normalized input', () => {
    expect(runPreliminaryCheck(VALID_INPUT)).toEqual(runPreliminaryCheck(VALID_INPUT));
  });
});
