# Design QA — hành trình vay và portal nội bộ

## Bằng chứng

- Trình duyệt: Google Chrome của người dùng.
- Desktop: 1440 × 1000; mobile: 390 × 844.
- Cửa khách sáng: `/tmp/shb-product-qa/01-public-light.png`.
- Kết quả sơ bộ sáng/tối: `/tmp/shb-product-qa/02-public-result-light.png`,
  `/tmp/shb-product-qa/03-public-result-dark.png`.
- Cửa khách mobile: `/tmp/shb-product-qa/04-public-mobile.png`.
- Portal quản lý: `/tmp/shb-product-qa/05-admin-dashboard.png`.
- Cấu hình: `/tmp/shb-product-qa/06-admin-policy.png`.
- Chi tiết hồ sơ: `/tmp/shb-product-qa/07-case-detail.png`.
- So sánh trước/sau cùng viewport: `/tmp/shb-product-qa/08-admin-comparison.png`.

## Kết quả

Không còn lỗi thiết kế P0/P1 trong phạm vi demo.

- Khách vay vào thẳng trang tư vấn, không có login wall.
- Hành trình chính hoạt động: chọn nhu cầu → chọn gói → nhập thông tin → xem kết quả sơ bộ.
- Kết quả luôn nói rõ chưa phải quyết định/cam kết tín dụng; không hiển thị score, CIC thô,
  C06, BHXH hoặc tiến độ tích hợp.
- `staff/staff` và `admin/admin` mở portal nội bộ; RBAC ẩn chính sách/giám sát với nhân viên.
- Card “Thông tin đã thu thập” đã bị loại bỏ; bảng hồ sơ dùng toàn chiều rộng.
- Mỗi dòng hồ sơ mở được drawer chi tiết với đề xuất, khả năng trả nợ, tài liệu và lịch sử xử lý.
- Admin xem được policy toàn hệ thống, cấu hình phục vụ theo đơn vị và tạo bản dự thảo.
- Light/dark mode và bố cục 390 px không bị chồng, cắt hoặc tràn ngang.
- Icon dùng nhất quán Lucide; avatar dùng asset thật trong project.

## Quyết định thiết kế quan trọng

Cấu hình vùng chỉ ưu tiên danh mục, SLA và phân tuyến. Ngưỡng/tỷ trọng tín dụng dùng chung
toàn tenant để địa lý không tự làm thay đổi eligibility. Thay đổi chính sách phải có phiên bản
và kiểm soát Risk/Legal.

## Giới hạn

QA này xác nhận sản phẩm demo và interaction ở frontend. Tenant isolation, policy
maker-checker bền vững và borrower session vẫn là blocker backend trước production; xem
`docs/AI_FIRST_LOAN_MVP.md`.

final result: passed
