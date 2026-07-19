# Rà soát ngôn ngữ — portal hồ sơ vay

## Đối tượng

- Nhân viên tín dụng: tiếp nhận, thẩm định, cập nhật hồ sơ được giao.
- Quản lý: xem toàn hệ thống/đơn vị, phê duyệt, giám sát và quản lý cấu hình.
- Khách vay không sử dụng portal và không cần đăng nhập.

## Chuẩn từ ngữ

| Không hiển thị | Từ dùng trên portal |
|---|---|
| Pipeline | Tiến độ hồ sơ |
| Agent HUD / Workspace | Khu vực xử lý hồ sơ |
| Control Tower | Trung tâm giám sát |
| Risk Engine / Decision Engine | Bộ điều kiện tín dụng |
| Rule / rune | Điều kiện / chính sách |
| Tenant | Đơn vị quản lý |
| Tool / trace / provider / model | Hoạt động nghiệp vụ / nguồn thông tin |
| MOCK API | Môi trường demo / dữ liệu minh họa |
| Giai đoạn 1 / giai đoạn 2 | Tiếp nhận / thẩm định |

Portal tổng quan không hiển thị “Thông tin đã thu thập”, CIC, C06 hoặc BHXH. Các nguồn đối
chiếu chỉ được trình bày trong ngữ cảnh hồ sơ khi thực sự phục vụ quyết định, không dùng như
trạng thái hệ thống.

## Kiểm tra

- Tổng quan: chỉ còn hành động ưu tiên, số liệu, biểu đồ và hồ sơ gần đây.
- Tiến độ: bảng có ngày tiếp nhận và nút mở chi tiết.
- Sản phẩm: thông tin nghiệp vụ và link nguồn SHB.
- Chính sách: version, ngày hiệu lực, điều kiện, tỷ trọng và cấu hình đơn vị.
- Chi tiết: đề xuất, khả năng trả nợ, điểm cần quan tâm, tài liệu, lịch sử.
- Không có các chuỗi `MOCK API`, `Agent HUD`, `Risk Engine`, `human-in-the-loop`,
  `Pipeline`, `Schema`, `C06`, `BHXH` hoặc `Giai đoạn` trong UI portal.
