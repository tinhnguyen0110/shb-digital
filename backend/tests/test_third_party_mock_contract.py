"""CIC/C06/BHXH must remain synthetic and must never silently switch to live mode."""

from __future__ import annotations

import os
import subprocess
import sys

from app.config import THIRD_PARTY_MODE
from app.integrations.third_party_mock import (
    bhxh_participation_normalized,
    c06_identity_normalized,
    cic_k11_normalized,
    mock_source,
)


def test_third_party_mode_is_mock_only():
    assert THIRD_PARTY_MODE == "mock"


def test_live_mode_fails_fast_at_boot():
    env = {**os.environ, "THIRD_PARTY_MODE": "live"}
    proc = subprocess.run(
        [sys.executable, "-c", "import app.config"],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert proc.returncode != 0
    assert "live CIC/C06/BHXH connectors are intentionally unsupported" in proc.stderr


def test_all_mock_sources_have_versioned_provenance():
    for provider in ("cic", "c06", "bhxh"):
        first = mock_source(provider, "C001", record_as_of="2026-07-18T00:00:00Z")
        second = mock_source(provider, "C001", record_as_of="2026-07-18T00:00:00Z")
        assert first == second
        assert first["isMock"] is True
        assert first["liveCall"] is False
        assert first["provider"].endswith("_MOCK")
        assert first["schemaVersion"] == "1.0"
        assert first["requestId"].startswith("mock-")
        assert first["dataClassification"] == "synthetic_fixture"
        assert "official provider API response" in first["disclaimer"]


def test_unknown_provider_fails_loud():
    try:
        mock_source("unknown", "C001")
    except ValueError as exc:
        assert "unknown mock provider" in str(exc)
    else:
        raise AssertionError("unknown providers must not be accepted")


def test_cic_normalized_contract_keeps_unavailable_values_explicit():
    report = cic_k11_normalized("C001", 2, "synthetic late payment", record_as_of="2026-07-18")
    assert report["debtClassification"]["worstGroup"] == 2
    assert report["currentCredit"]["loanOutstandingVnd"] is None
    assert report["currentCredit"]["availability"] == "not_available_in_legacy_fixture"
    assert report["negativeHistory"]["lookback"] == {
        "specialMentionMonths": 12,
        "badLoanYears": 5,
        "badCardYears": 3,
    }


def test_c06_contract_is_identity_verification_not_a_claimed_official_api():
    report = c06_identity_normalized(
        "C013",
        identity_match=False,
        mismatches=[{"field": "full_name"}],
        record_as_of="2026-07-18",
    )
    assert report["verification"]["status"] == "mismatch"
    assert report["biometric"]["status"] == "not_performed"
    assert report["source"]["isMock"] is True


def test_bhxh_contribution_salary_is_not_take_home_income():
    report = bhxh_participation_normalized(
        "C001",
        employer="MOCK COMPANY",
        tenure_months=24,
        contribution_salary_vnd=20_000_000,
        status="active",
        verified_at="2026-07-18",
    )
    assert report["participation"]["contributionSalaryVnd"] == 20_000_000
    assert report["incomeUsePolicy"]["isTakeHomeIncome"] is False
