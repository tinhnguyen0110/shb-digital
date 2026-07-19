"""Versioned provenance for synthetic CIC/C06/BHXH responses.

These are normalized internal contracts based on publicly documented business fields. They
are not copies of, nor claims about, any non-public government API response schema.
"""

from __future__ import annotations

import hashlib
from typing import Any

from app.config import THIRD_PARTY_MODE

_CONTRACTS = {
    "cic": ("CIC_MOCK", "vn-cic-k11-normalized", "1.0"),
    "c06": ("C06_MOCK", "vn-c06-identity-verification-normalized", "1.0"),
    "bhxh": ("BHXH_MOCK", "vn-bhxh-participation-normalized", "1.0"),
}


def mock_source(provider: str, owner_id: str, *, record_as_of: str | None = None) -> dict[str, Any]:
    """Return machine-readable evidence that a third-party result is synthetic."""
    if THIRD_PARTY_MODE != "mock":  # defensive: config already fails fast at import time
        raise RuntimeError("live third-party mode is unsupported")
    try:
        name, contract, version = _CONTRACTS[provider]
    except KeyError as exc:
        raise ValueError(f"unknown mock provider: {provider}") from exc

    request_id = hashlib.sha256(f"{provider}:{owner_id}:{version}".encode()).hexdigest()[:16]
    return {
        "isMock": True,
        "liveCall": False,
        "provider": name,
        "contract": contract,
        "schemaVersion": version,
        "requestId": f"mock-{request_id}",
        "recordAsOf": record_as_of,
        "dataClassification": "synthetic_fixture",
        "disclaimer": "Synthetic mock; not an official provider API response.",
    }


def cic_k11_normalized(
    owner_id: str,
    cic_group: int | None,
    history_note: str | None,
    *,
    record_as_of: str,
) -> dict[str, Any]:
    """Normalized subset of the public K11 report; unknown values stay explicit."""
    return {
        "source": mock_source("cic", owner_id, record_as_of=record_as_of),
        "subject": {"subjectRef": owner_id, "identityStatus": "fixture_linked"},
        "currentCredit": {
            "loanOutstandingVnd": None,
            "cardOutstandingVnd": None,
            "vamcOutstandingVnd": None,
            "availability": "not_available_in_legacy_fixture",
        },
        "debtClassification": {
            "worstGroup": cic_group,
            "groupScale": {"min": 1, "max": 5},
        },
        "negativeHistory": {
            "note": history_note,
            "lookback": {
                "specialMentionMonths": 12,
                "badLoanYears": 5,
                "badCardYears": 3,
            },
        },
        "collateral": {"status": "not_collected_in_legacy_fixture", "count": None},
        "creditScore": {"score": None, "rank": None, "status": "not_scored_in_legacy_fixture"},
    }


def c06_identity_normalized(
    owner_id: str,
    *,
    identity_match: bool,
    mismatches: list[dict[str, Any]],
    record_as_of: str,
) -> dict[str, Any]:
    """Internal C06 mock contract limited to identity verification fields."""
    return {
        "source": mock_source("c06", owner_id, record_as_of=record_as_of),
        "subject": {"subjectRef": owner_id},
        "verification": {
            "status": "matched" if identity_match else "mismatch",
            "identityMatch": identity_match,
            "checkedFields": ["id_number", "full_name", "address"],
            "mismatches": mismatches,
        },
        "biometric": {"status": "not_performed"},
    }


def bhxh_participation_normalized(
    owner_id: str,
    *,
    employer: str | None,
    tenure_months: int | None,
    contribution_salary_vnd: float | None,
    status: str | None,
    verified_at: str | None,
) -> dict[str, Any]:
    """Internal BHXH mock contract; contribution salary is not take-home income."""
    return {
        "source": mock_source("bhxh", owner_id, record_as_of=verified_at),
        "subject": {"subjectRef": owner_id},
        "participation": {
            "employer": employer,
            "tenureMonths": tenure_months,
            "status": status,
            "lastRecordedAt": verified_at,
            "contributionSalaryVnd": contribution_salary_vnd,
        },
        "incomeUsePolicy": {
            "isTakeHomeIncome": False,
            "allowedUse": "employment_and_contribution_cross_check",
            "warning": "Do not substitute contribution salary for verified take-home income.",
        },
    }
