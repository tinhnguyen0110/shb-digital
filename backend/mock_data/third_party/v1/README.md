# Third-party mock contracts v1

All CIC, C06 and BHXH data in this project is synthetic. The database tables
`cic_records`, `police_records` and `employment_records` are local fixture projections,
not replicas of a live provider database.

Runtime responses must include:

- `isMock: true`
- `liveCall: false`
- a provider name ending in `_MOCK`
- `contract` and `schemaVersion`
- deterministic `requestId`
- `dataClassification: synthetic_fixture`

Normalized contracts:

| Provider | Internal contract | Public fields used as reference |
|---|---|---|
| CIC | `vn-cic-k11-normalized/1.0` | identity, current loan/card outstanding, debt classification and history, collateral, credit score/rank |
| C06 | `vn-c06-identity-verification-normalized/1.0` | personal identifier and identity-field matching; this is not a claim about a non-public C06 API schema |
| BHXH | `vn-bhxh-participation-normalized/1.0` | participant identifier, employer, participation period/status and contribution salary; contribution salary must not be presented as take-home income |

Public references used to shape the normalized fixture contracts:

- CIC K11 sample report: <https://cic.gov.vn/files/content/ratting/maubaocao/k11.pdf>
- CIC product field summary: <https://cic.gov.vn/files/content/ratting/maubaocao/GiaSaPham.pdf>
- BHXH participation lookup guide: <https://baohiemxahoi.gov.vn/Publishing_Home/TaiLieuHuongDan/HD_tracuuquatrinhthamgia.pdf>
- Decision 06/QĐ-TTg on population-data identity and authentication:
  <https://vanban.chinhphu.vn/?classid=0&docid=205022&pageid=27160>

The current legacy tables contain only the subset consumed by phase 1–2 tools. Expanding
the fixtures must preserve these normalized contracts and must never add copied production
responses or real personal data.
