# Rà soát ngôn ngữ sản phẩm

## Persona

| Persona | Tên hiển thị | Đăng nhập |
|---|---|---:|
| Borrower | Khách vay / bạn | Không |
| Backend role `user` | Nhân viên tín dụng | Có |
| Backend role `admin` | Quản lý | Có |

Không quảng bá account customer legacy hoặc `user/user`. Demo được hỗ trợ là
`staff/staff` và `admin/admin`.

## Cửa khách

- Dùng “gói vay”, “kiểm tra điều kiện”, “kết quả sơ bộ”, “chuyên viên xem xét”.
- Không dùng “phê duyệt” cho kết quả tự động.
- Không hiển thị score, reason code, adapter, model, workflow hay dữ liệu CIC/C06/BHXH thô.
- Luôn có câu: kết quả minh họa, chưa phải quyết định hoặc cam kết cấp tín dụng.
- Tách rõ thông tin sản phẩm lấy từ website SHB và dữ liệu đối chiếu demo là dữ liệu mô phỏng.

## Portal

- Dùng từ nghiệp vụ quản lý: hồ sơ, tiến độ, thẩm định, chính sách, đơn vị, tài liệu.
- Tên kỹ thuật chỉ tồn tại trong code/audit log, không nằm trên màn hình chính.
- “Cấu hình theo đơn vị” chỉ mô tả SLA, phân tuyến và sản phẩm ưu tiên; điều kiện tín dụng
  toàn hệ thống được diễn đạt riêng để tránh hiểu nhầm khu vực quyết định eligibility.

## Trạng thái kiểm tra

Các test UI bảo vệ cửa khách không login, RBAC staff/admin, logout về cửa khách, light/dark,
chi tiết hồ sơ, draft policy và danh sách từ cấm trong portal.
