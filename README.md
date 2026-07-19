# shb-digital

**Đề 132 — Hệ thống hỗ trợ thẩm định tín dụng SHB**.
Vietnam AI Innovation Challenge 2026 / Hack CX Together 2026.

## Chạy dự án

### Demo giao diện (không cần backend)

```bash
cd frontend
npm install
npm run dev
```

Truy cập <http://localhost:5173>. Nhân viên đăng nhập bằng `staff / staff`; quản lý đăng nhập
bằng `admin / admin`. Khách vay đi vào luồng tiếp nhận công khai và không cần tài khoản đăng nhập.
Chế độ này luôn dùng dữ liệu minh họa, gồm CIC và các nguồn bên thứ ba.

### Chạy đầy đủ với backend

Yêu cầu máy có:

- Docker Desktop/Engine kèm Docker Compose v2.
- Node.js 20.19+ hoặc 22.12+.

Từ thư mục gốc, chạy:

```bash
./run.sh
```

Launcher tự chuẩn bị `.env`, Python/Node dependencies, Postgres, migration và seed rồi mở:

- UI: <http://localhost:5173>
- API docs: <http://localhost:8000/docs>

Những gì đã có hoặc đang chạy sẽ được nhận diện và bỏ qua; chạy lại không tải dependency,
không seed đè dữ liệu và không tạo server trùng. Dừng API/UI bằng `Ctrl+C`; Postgres được giữ
để lần sau khởi động nhanh.

Xem hướng dẫn đầy đủ, cấu hình AI provider và xử lý lỗi tại
[`docs/RUN.md`](docs/RUN.md).

## Đề bài

Xem [`docs/problem-statement.md`](docs/problem-statement.md) (PDF gốc: [`docs/132-SHB-agents.pdf`](docs/132-SHB-agents.pdf)).

Tóm tắt: một team các "chuyên gia số" (Credit · Legal · Products · Operations), 1 MAIN điều
phối + các SUB chuyên gia — tự chia việc, dùng tool (tính bằng tool, không nhẩm), phối hợp,
**thực thi hành động có phanh** (việc nhạy cảm dừng chờ người duyệt). Mọi bước có vết, mọi con
số có nguồn. Không chatbot trả lời — là đội-làm-việc có giám sát, có phanh, có bằng chứng.

## Tài liệu

- **`docs/AI_FIRST_LOAN_MVP.md`** — persona, RBAC, ranh giới AI/Decision Engine, cấu hình đơn vị và điều kiện trước production.
- **`SPEC.md`** — sản phẩm là gì (nguyên lý → kiến trúc → cơ chế → contract → rule).
- **`docs/patterns/`** — cách build từng phần (5 pattern doc + `00-INDEX.md`).
- **`DECISIONS.md`** — sổ quyết định ngoài-dự-tính (human-wins, đảo được).
- **`CLAUDE.md`** — luật vận hành đội build (§0 kim chỉ nam: Thử · Sai · Sửa).
- **`design/`** — mock look-and-feel (tham khảo, không phải nguồn scope — D-13/D-14).
