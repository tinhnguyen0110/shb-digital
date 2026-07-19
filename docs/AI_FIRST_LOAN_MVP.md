# Kiến trúc MVP tư vấn và kiểm tra khoản vay

Tài liệu này chốt phạm vi hiện tại: cửa khách vay công khai, portal nhân viên/quản lý, giai
đoạn tiếp nhận và kiểm tra điều kiện sơ bộ. Mọi dữ liệu CIC, C06, BHXH và bên thứ ba trong
demo đều là dữ liệu tổng hợp; hệ thống không có đường gọi dịch vụ thật.

## 1. Persona và quyền

| Persona | Đăng nhập | Phạm vi |
|---|---:|---|
| Khách vay | Không | Xem sản phẩm, nhận gợi ý theo nhu cầu, nhập thông tin và xem kết quả sơ bộ |
| Nhân viên tín dụng | Có | Tiếp nhận, xem, thẩm định và cập nhật hồ sơ thuộc đơn vị được giao |
| Quản lý | Có | Quyền của nhân viên, phê duyệt, quản lý cấu hình và xem giám sát |

Frontend hiện giữ tên role backend cũ `user` để tương thích API, nhưng chỉ trình bày là
“Nhân viên tín dụng”. Role `customer` cũ không còn được đưa vào hành trình sản phẩm.

## 2. Ranh giới AI và bộ quyết định

AI được phép:

- hỏi nhu cầu bằng ngôn ngữ tự nhiên;
- gợi ý sản phẩm từ catalog đã kiểm duyệt;
- nhắc người dùng bổ sung trường còn thiếu;
- diễn giải các reason code đã được cho phép.

AI không được phép:

- tự tính điểm hoặc sửa input đã chuẩn hóa;
- đổi ngưỡng, trọng số, phiên bản chính sách hoặc outcome;
- biến kết quả sơ bộ thành phê duyệt;
- gửi dữ liệu định danh hoặc dữ liệu đối chiếu thô ra model.

Kết quả khoản tín chấp dưới 10 triệu đồng do hàm quyết định thuần
`runPreliminaryCheck()` tạo ra. Đúng 10 triệu đồng nằm ngoài phạm vi kiểm tra nhanh.
Các tín hiệu cần xem xét, như dữ liệu thanh toán có cảnh báo hoặc nguồn thu nhập chưa ổn
định, được chuyển cho nhân viên thay vì tự động từ chối.

## 3. Tenant theo vùng và cấu hình đơn vị

Giai đoạn hiện tại coi mỗi vùng là một tenant độc lập:

| Tenant | Region | Tên hiển thị |
|---|---|---|
| `shb-north` | `north` | SHB Bán lẻ · Miền Bắc |
| `shb-central` | `central` | SHB Bán lẻ · Miền Trung |
| `shb-south` | `south` | SHB Bán lẻ · Miền Nam |

Mọi tài khoản nội bộ và hồ sơ hội thoại đều mang `tenant_id`. Backend nạp tenant từ bản ghi
người dùng đã xác thực, tự đóng dấu tenant khi tạo hồ sơ và không nhận tenant từ request body.
Các API hội thoại, chat, SSE, interrupt, phê duyệt, audit và so sánh đều kiểm tra tenant trước
khi đọc hoặc thay đổi dữ liệu; id thuộc vùng khác được trả như không tồn tại.

Quyền tính năng được lưu theo cặp `(tenant_id, role)`. Nhân viên và quản lý chỉ được quản trị
trong tenant của chính mình. Khu vực người dùng và ma trận quyền là quyền bảo vệ dành riêng
cho Quản lý, không thể tự gán ngược cho Nhân viên tín dụng. Quyền phụ thuộc cũng được kiểm tra:
ví dụ quyền thẩm định/phê duyệt luôn cần quyền xem hồ sơ. Tài khoản hoặc tenant bị khóa bị từ
chối ngay cả khi JWT cũ còn hạn.

Tạo cán bộ trên portal không nhận mật khẩu. Backend sinh một bí mật ngẫu nhiên không được trả
ra ngoài, chỉ cho tạo vai trò Nhân viên tín dụng, tạo account ở trạng thái chưa hoạt động và
trả `activation_required: true`. Quản lý không thể bật account này trước khi quy trình kích
hoạt hoàn tất, không thể tự vô hiệu hóa mình và không thể vô hiệu hóa Quản lý hoạt động cuối
cùng của đơn vị. Tài khoản Quản lý mới phải do hệ thống quản trị danh tính trung tâm cấp.
Demo chưa gửi email/SMS và chưa có endpoint nhận lời mời/kích hoạt; đó là integration bắt buộc
phải bổ sung trước production. Không được diễn giải response tạo account như đã gửi lời mời.

Cấu hình nghiệp vụ được tách thành hai lớp:

1. **Chính sách tín dụng toàn tenant**: ngưỡng bắt buộc, trọng số, phiên bản, ngày hiệu lực.
2. **Cấu hình phục vụ theo đơn vị**: sản phẩm ưu tiên, SLA tiếp nhận và phân tuyến nhân viên.

Khu vực không trực tiếp thay đổi điều kiện đủ/không đủ. Nếu SHB muốn một vùng dùng ngưỡng
hoặc trọng số tín dụng khác, thay đổi đó phải được Risk/Legal phê duyệt, version hóa, dry-run
và kiểm thử công bằng trước khi phát hành.

Đây hiện là **cô lập ở tầng ứng dụng**, chưa phải biên an toàn cuối cùng ở database. Migration
đã thêm khóa ngoại và cột tenant nhưng chưa triển khai PostgreSQL Row-Level Security (RLS), và
chưa tách database role chạy migration khỏi role runtime. Vì vậy kết nối SQL trực tiếp có đặc
quyền cao vẫn có thể bỏ qua bộ lọc ứng dụng. Trước production phải thêm RLS, policy cho từng
bảng tenant-scoped, runtime role không sở hữu bảng và kiểm thử chống truy cập chéo tenant ở DB.

## 4. Contract dữ liệu mock

Evidence CIC trong kiểm tra nhanh có provenance bắt buộc:

- `provider = CIC_MOCK`;
- `contract = vn-cic-k11-normalized`;
- `schemaVersion`, `requestId`, `recordAsOf`;
- `isMock = true`, `liveCall = false`;
- cảnh báo dữ liệu tổng hợp.

Evidence thiếu, sai contract, không còn hiệu lực hoặc không khả dụng không được phép suy đoán;
outcome phải là `NEEDS_INFORMATION`. C06/BHXH mock ở backend tuân theo cùng nguyên tắc
provenance và fail-closed.

## 5. Những gì đã có và điều kiện trước production

Đã có trong demo:

- cửa khách không đăng nhập;
- catalog sản phẩm có link nguồn SHB;
- kiểm tra nhanh deterministic và test boundary;
- RBAC theo permission cho nhân viên/quản lý, có API quản lý user và ma trận role;
- cô lập tenant theo vùng ở tầng API cho hồ sơ, phê duyệt, audit và luồng realtime;
- lọc theo đơn vị, cấu hình versioned, chi tiết hồ sơ;
- light/dark mode và dữ liệu demo.

Chưa được coi là production-ready cho đến khi hoàn tất:

- PostgreSQL RLS và tách migration role/runtime role để củng cố cô lập tenant ở database;
- kiểm thử end-to-end tenant isolation trên PostgreSQL dành riêng cho CI;
- borrower session/capability token nếu lưu hồ sơ sau phiên công khai;
- policy store có maker-checker, audit log, effective date và rollback;
- mã hóa dữ liệu, retention/consent, rate limit, chống gian lận và kiểm thử phân quyền ngang;
- integration contract đã được SHB phê duyệt cho CIC/C06/BHXH; trước thời điểm đó chỉ chạy mock;
- model gateway có redaction, allowlist, tracing và eval cho mọi nội dung do AI diễn giải.
