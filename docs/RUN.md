# Hướng dẫn chạy dự án

## Demo giao diện độc lập

Không cần backend, cơ sở dữ liệu hay Docker:

```bash
cd frontend
npm install
npm run dev
```

Mở <http://localhost:5173>. Khách vay dùng luồng tiếp nhận công khai, không cần tài khoản.
Nhân viên ngân hàng dùng một trong hai tài khoản:

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Nhân viên tín dụng | `staff` | `staff` |
| Quản lý | `admin` | `admin` |

Lệnh này luôn bật dữ liệu minh họa. Dữ liệu CIC và toàn bộ nguồn bên thứ ba không gọi hệ thống
thật. Nhãn “MÔI TRƯỜNG DEMO · Dữ liệu minh họa” trên màn hình đăng nhập giúp nhận biết chế độ này.

Chỉ dùng `npm run dev:api` khi chủ động kết nối frontend tới backend đang chạy ở cổng `8000`.
Kể cả khi công cụ phát triển gọi `vite` trực tiếp, ứng dụng vẫn mặc định dùng dữ liệu minh họa.

## Cách nhanh nhất

### 1. Chuẩn bị một lần

- Docker Desktop (macOS/Windows) hoặc Docker Engine + Compose v2 (Linux).
- Node.js 20.19+ hoặc 22.12+.
- macOS, Linux hoặc WSL có Bash và `curl`.

Không cần cài Python hay `uv` trước. Launcher sẽ cài `uv` vào `.tools/bin` trong dự án và
`uv` tự chuẩn bị đúng Python theo `backend/.python-version`.

Nếu chạy trên một DB hoàn toàn mới, repo nguồn `shb-digital-experts` cần nằm cạnh repo này để
đọc bộ seed LAB:

```text
parent/
├── shb-digital/
└── shb-digital-experts/missions/shb-132/seed/shb-132.db
```

DB đã có dữ liệu sẽ không cần file seed và launcher sẽ bỏ qua bước này.

### 2. Chạy một lệnh

```bash
./run.sh
```

Trên macOS, launcher tự mở Docker Desktop nếu ứng dụng đã cài nhưng chưa chạy. Trên Linux,
Docker daemon cần được khởi động trước.

Khi thấy thông báo `Hệ thống hỗ trợ thẩm định tín dụng SHB đã chạy`, truy cập:

| Thành phần | Địa chỉ |
|---|---|
| Giao diện | <http://localhost:5173> |
| API docs | <http://localhost:8000/docs> |
| Health check | <http://localhost:8000/api/health> |

Launcher mặc định yêu cầu nhân viên/quản lý đăng nhập và nối frontend với backend thật tại
cổng `8000`. Chỉ bật `DEV_SKIP_AUTH=1` trong `.env` khi cần bỏ qua đăng nhập để debug local;
không dùng cờ này trong production. Khi triển khai qua HTTPS, bắt buộc đặt
`AUTH_COOKIE_SECURE=1`.

### 3. Dừng

Nhấn `Ctrl+C` tại terminal chạy launcher. Backend và frontend do launcher tạo sẽ dừng; container
Postgres và volume dữ liệu vẫn được giữ để lần chạy sau nhanh hơn.

Muốn dừng cả Postgres:

```bash
docker compose down
```

Không thêm `-v` trừ khi chủ động muốn xóa toàn bộ dữ liệu Postgres.

## Launcher tự làm gì?

Mỗi lần chạy, `run.sh` kiểm tra trạng thái trước khi thực hiện:

1. Nếu cả API và UI đã sẵn sàng, in URL rồi thoát, không tạo process trùng.
2. Tạo `.env` từ `.env.example` nếu chưa có; không ghi đè `.env` hiện hữu.
3. Dùng `uv` có sẵn hoặc cache `.tools/bin/uv`; chỉ tải khi máy chưa có.
4. Chỉ chạy đồng bộ Python khi `.venv` không khớp `uv.lock`.
5. Chỉ chạy `npm ci` khi `node_modules` thiếu hoặc không khớp lockfile.
6. Tái sử dụng Postgres đang chạy; nếu chưa có thì tái sử dụng image, container và volume Docker.
7. Chạy Alembic idempotent để chỉ áp dụng migration còn thiếu.
8. Chỉ seed dữ liệu nghiệp vụ khi DB rỗng; chỉ bổ sung demo user còn thiếu.
9. Khởi động FastAPI cổng `8000` và Vite cổng `5173`; dịch vụ đúng cổng đã chạy sẽ không bị tạo trùng.

Vì launcher không reset dữ liệu khi khởi động, các ca làm việc và audit cũ được giữ nguyên.

## Cấu hình AI provider

API và UI có thể khởi động mà chưa có API key, nhưng lượt chat AI cần một provider sử dụng
được. Sửa `.env` theo một trong các cách:

### Claude CLI đã đăng nhập

Giữ mặc định `claude-cli`. Máy cần có phiên đăng nhập Claude CLI hợp lệ.

### z.ai

```dotenv
SHB_PROVIDER=zai
zai=YOUR_API_KEY
```

Không commit `.env`; file này đã được gitignore.

## Cấu hình DB khác

Đặt `DATABASE_URL` trong `.env`:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
```

Khi URL khác URL local mặc định, launcher dùng DB đó và bỏ qua container Postgres trong
`docker-compose.yml`. DB user cần quyền tạo/thay đổi schema để Alembic chạy.

## Lỗi thường gặp

### `Docker daemon chưa chạy`

Mở Docker Desktop, hoặc khởi động Docker service trên Linux, rồi chạy lại `./run.sh`.

### `Node.js ... không tương thích Vite`

Cập nhật Node.js lên 20.19+ hoặc 22.12+ rồi chạy lại. Không cần xóa `node_modules`; launcher
tự kiểm tra và cài lại khi cần.

### Thiếu `shb-132.db`

Lỗi này chỉ xảy ra khi Postgres chưa có dữ liệu nghiệp vụ. Checkout repo
`shb-digital-experts` cạnh `shb-digital` theo cây thư mục ở phần “Chuẩn bị một lần”, rồi chạy
lại. Không tự tạo dữ liệu thay thế vì đây là nguồn fixture nghiệp vụ chuẩn của dự án.

### Cổng `8000` hoặc `5173` đã bị ứng dụng khác chiếm

Dừng ứng dụng đang chiếm cổng rồi chạy lại. Launcher chỉ tái sử dụng cổng khi health check xác
nhận đúng backend/UI của dự án.

### Xem log Postgres

```bash
docker compose logs -f db
```

Tài liệu tham khảo cho công cụ được launcher sử dụng:
[cài đặt uv](https://docs.astral.sh/uv/getting-started/installation/) và
[yêu cầu Node.js của Vite](https://vite.dev/guide/).
