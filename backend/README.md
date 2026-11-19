# ChillCat Studio – máy chủ (backend)

Máy chủ cho tab **Dự án** của ChillCat Studio: quản lý tài liệu theo quy trình, đúng đặc tả `desc.txt`.

- **Rust** (axum, tokio) · **MongoDB** (driver chính thức, hướng tới **MongoDB Atlas**; chạy được với replica set tự quản).
- **Monolith chia module** – một tiến trình, một lần triển khai – nhưng mỗi module là một crate độc lập, giao tiếp qua hợp đồng
  và sự kiện, nên tách thành dịch vụ riêng mà không phải viết lại (xem [Kiến trúc](#kiến-trúc)).
- Một tiến trình phục vụ cả **API** (`/api/v1`) lẫn **giao diện** (thư mục gốc của repo, `STATIC_DIR`).

Các điểm đặc tả còn để ngỏ và cách đã chọn: [docs/DECISIONS.md](docs/DECISIONS.md).

## Chạy trên máy

Cần: Rust 1.85+ (`rustup`), MongoDB **replica set** (transaction cần replica set – Atlas luôn là replica set).

```powershell
# 1. MongoDB cục bộ (Windows, không cần quyền admin): tải bản zip vào backend/.dev/, chạy replica set một node ở cổng 27117
powershell -ExecutionPolicy Bypass -File backend/scripts/dev-mongo.ps1

# 2. Cấu hình
cd backend
copy .env.example .env      # sửa nếu cần; mặc định nối MongoDB ở bước 1, phục vụ giao diện ở thư mục cha

# 3. Chạy
cargo run -p chillcat-server
```

Mở <http://localhost:8080> → tab **Dự án** (`Alt+4`) → **Tạo tài khoản**. Người đăng ký đầu tiên trên hệ thống trống là
**quản trị hệ thống**. Dừng MongoDB: `powershell -File backend/scripts/dev-mongo.ps1 -Stop`.

Trên Linux / macOS: chạy `mongod --replSet rs0 --port 27117 --dbpath <thư mục>` rồi `mongosh --port 27117 --eval "rs.initiate()"`.

### Kiểm thử

```bash
cargo test --workspace          # unit + tích hợp (cần MongoDB ở MONGODB_URI, mặc định cổng 27117 như trên)
cargo clippy --workspace --all-targets
node scripts/smoke.mjs http://localhost:8080/api/v1   # thử đầu-cuối qua HTTP với máy chủ đang chạy (Node 18+)
cd scripts/e2e && npm install && node ui.mjs && node ui-team.mjs   # giao diện trên Chrome thật – xem scripts/e2e/README.md
```

Kiểm thử tích hợp mỗi bài dùng một CSDL tạm tên ngẫu nhiên và tự xoá. Đáng chú ý:

| Kiểm thử | Nội dung |
| --- | --- |
| `crates/documents/tests/lifecycle.rs` | Vòng đời đầy đủ: tạo từ mẫu, khoá lạc quan, cảnh báo phải xác nhận, chặn phát hành khi tài liệu ↑ chưa phát hành, trả lại → 0.2, 1.0 → 2.0, Thay thế, cờ **Cần rà soát**, Công khai |
| `crates/workspaces/tests/permissions.rs` | Quyền §3, §4.1, §9: không cấp quá quyền mình có, phạm vi rộng hơn, owner duy nhất, chuyển quyền phụ trách |
| `crates/tickets/tests/tickets.rs` | Quyền ticket §4.4: người ngoài, không có quyền mặc định, uỷ quyền, cấp cho group; kiểm tra trùng; chặn vòng trùng |
| `crates/documents/src/policy.rs` | Ma trận ai xem được bản nào theo trạng thái (§5.1) và mức bảo mật (§6) |
| `crates/traceability/tests/templates.rs` | Bộ đọc mã truy vết chạy trên 16 mẫu thật trong `templates/` |

## Cấu hình

Biến môi trường (hoặc file `.env`) – đầy đủ trong [.env.example](.env.example). Quan trọng nhất:

| Biến | Ý nghĩa |
| --- | --- |
| `MONGODB_URI` | Atlas: `mongodb+srv://<user>:<mật khẩu>@<cluster>.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB` | Tên CSDL (mặc định `chillcat`). `MONGODB_DB_<MODULE>` tách CSDL theo module |
| `JWT_SECRET` | ≥ 32 ký tự ngẫu nhiên; **bắt buộc** khi `APP_ENV=prod` |
| `PUBLIC_BASE_URL` | Địa chỉ người dùng mở app; `https://…` ⇒ cookie phiên có cờ `Secure` |
| `STATIC_DIR` | Thư mục giao diện (mặc định trong `.env.example`: `..` = gốc repo). Bỏ trống = chỉ API |
| `CORS_ALLOWED_ORIGINS` | Khi giao diện ở tên miền khác máy chủ |
| `AI_PROVIDER` | `none` (so khớp từ khoá) hoặc `anthropic` (Claude, cần `AI_API_KEY`) |
| `WORKSPACE_CREATION` | `all` (mọi người) / `admin` – ai được tạo workspace |

### MongoDB Atlas

1. Tạo cluster (M10 trở lên cho môi trường thật; M0 dùng thử được). Transaction có sẵn.
2. **Database Access**: tạo user chỉ có quyền `readWrite` trên CSDL `chillcat` (và các CSDL `MONGODB_DB_*` nếu tách).
3. **Network Access**: cho phép IP / VPC của máy chủ.
4. Đặt `MONGODB_URI` = chuỗi kết nối `mongodb+srv://…` (TLS tự bật). Máy chủ dùng Stable API v1, ghi `w=majority`,
   tự thử lại transaction khi Atlas chuyển primary.
5. Chỉ mục được tạo tự động khi khởi động (idempotent); chỉ mục TTL tự xoá nhật ký sau 2 năm, thông báo sau 180 ngày,
   phiên đăng nhập khi hết hạn.

Tìm kiếm ticket dùng chỉ mục văn bản (`$text`) – có thể thay bằng Atlas Search sau.

## Kiến trúc

```text
backend/
├── apps/server/            tiến trình monolith: nạp cấu hình, nối module, chạy outbox relay + tác vụ định kỳ, phục vụ API + giao diện
└── crates/
    ├── kernel/             hợp đồng dùng chung, KHÔNG có I/O: mã định danh, AppError, quyền, sự kiện, trait giữa module
    ├── platform/           hạ tầng: cấu hình, MongoDB (transaction, chỉ mục), outbox, lỗi HTTP, xác thực JWT
    ├── identity/           tài khoản, đăng nhập, phiên (refresh token xoay vòng, cookie HttpOnly), quản trị người dùng
    ├── workspaces/         workspace, group, hệ thống con, thành viên, lời mời, phép tính quyền (§3, §4.1, §9)
    ├── documents/          24 loại tài liệu (mẫu nhúng sẵn), tài liệu, phiên bản, vòng đời, bảo mật, quan hệ, nhận xét (§5–§7)
    ├── traceability/       đọc mã truy vết, sổ mã, Cần rà soát (§7.2–§7.4)
    ├── tickets/            ticket, quyền xem / xử lý, AI kiểm tra trùng + đề xuất tài liệu (§4.4, §5.4)
    ├── notifications/      thông báo trong ứng dụng (từ sự kiện)
    └── audit/              nhật ký (từ sự kiện, TTL 2 năm)
```

Quy tắc giữ cho việc tách dịch vụ sau này rẻ:

1. **Module không phụ thuộc nhau.** Mỗi crate nghiệp vụ chỉ phụ thuộc `kernel` và `platform`. Cần gì ở module khác thì gọi
   **trait** trong `kernel::contracts` (`IdentityApi`, `AccessApi`, `DocumentsApi`, `TraceApi`); `apps/server` là nơi duy nhất
   nối trait với phần cài đặt. Tách module ⇒ thay phần cài đặt trong cùng tiến trình bằng client HTTP/gRPC.
2. **Mỗi module sở hữu collection của mình**, trong CSDL riêng nếu đặt `MONGODB_DB_<MODULE>`. Không module nào đọc
   collection của module khác.
3. **Phản ứng giữa module đi qua sự kiện miền** (`kernel::events`), ghi vào **outbox** trong cùng transaction với thay đổi
   dữ liệu; relay phát cho handler (ít nhất một lần, handler idempotent). Ví dụ: phát hành tài liệu → traceability cập nhật
   sổ mã → documents báo người phụ trách tài liệu Cần rà soát → notifications tạo thông báo → audit ghi nhật ký.
   Tách dịch vụ ⇒ relay đẩy sự kiện ra message broker.
4. **Xác thực không trạng thái**: access token JWT 15 phút kiểm tra tại chỗ ở mọi module; chỉ identity giữ khoá ký và phiên.
5. Mỗi module có router riêng (`Module::router`), chỉ mục riêng (`Module::init`), handler và tác vụ định kỳ riêng.

### Quy ước API

- JSON, `snake_case`, thời điểm RFC 3339 UTC. Đăng nhập: `Authorization: Bearer <access_token>`; làm mới phiên bằng cookie
  HttpOnly `cc_refresh` (cùng origin) hoặc `refresh_token` trong thân yêu cầu (khác origin).
- Lỗi: `{ "error": { "code": "document.not_draft", "message": "…tiếng Việt…", "details": … } }`.
  `401` chưa đăng nhập · `403` thấy nhưng không được làm · `404` không có **hoặc không được biết là có** · `409` xung đột
  (khoá lạc quan, cần xác nhận cảnh báo) · `422` vi phạm quy tắc (thiếu điều kiện gửi duyệt / phát hành).
- Mọi phản hồi API có `Cache-Control: no-store`; service worker của giao diện bỏ qua `/api/`.

### Điểm cuối chính (tính từ `/api/v1`)

| Nhóm | Điểm cuối |
| --- | --- |
| Đăng nhập | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `GET/PATCH /me` · `POST /me/password` |
| Workspace | `GET/POST /workspaces` · `GET /workspaces/directory` · `GET/PATCH /workspaces/{ws}` · `POST /workspaces/{ws}/transfer` |
| Group, hệ thống con | `GET/POST /workspaces/{ws}/groups` · `PATCH/DELETE /groups/{id}` · `PUT /groups/{id}/owner` · `GET/POST /workspaces/{ws}/subsystems` · `PATCH/DELETE /subsystems/{id}` |
| Thành viên, lời mời | `GET /workspaces/{ws}/members` · `PATCH/DELETE /memberships/{id}` · `GET/POST /workspaces/{ws}/invitations` · `DELETE /invitations/{id}` · `GET /me/invitations` · `POST /invitations/{id}/accept\|decline` |
| Tài liệu | `GET /document-types` · `GET/POST /workspaces/{ws}/documents` · `GET/PATCH/DELETE /documents/{id}` · `POST /documents/{id}/archive\|unarchive` · `POST /documents/{id}/versions` · `GET /documents/{id}/reviews` · `POST /documents/{id}/links` · `DELETE /links/{id}` |
| Phiên bản | `GET /versions/{id}` · `PUT /versions/{id}/content` · `POST /versions/{id}/lint` · `GET /versions/{id}/check/{submit\|publish}` · `POST /versions/{id}/{submit\|withdraw\|reject\|approve\|reopen\|publish}` · `PUT /versions/{id}/editor` |
| Nhận xét | `GET/POST /versions/{id}/comments` · `PATCH/DELETE /comments/{id}` · `POST /comments/{id}/resolve\|reopen` |
| Công khai | `GET /public/documents/{id}` (không cần đăng nhập) |
| Truy vết | `GET /workspaces/{ws}/trace/elements[/{code}]` · `GET /workspaces/{ws}/trace/flags` · `POST /trace/flags/{id}/resolve` |
| Ticket | `GET/POST /workspaces/{ws}/tickets` · `GET /me/tickets` · `GET/PATCH /tickets/{id}` · `POST /tickets/{id}/status\|assign\|duplicate` · `POST /tickets/{id}/ai/duplicates\|proposals` · `POST /ticket-candidates/{id}/decision` · `POST /ticket-proposals/{id}/decision\|draft` |
| Quyền ticket | `GET /workspaces/{ws}/ticket-access` · `POST /workspaces/{ws}/ticket-grants` · `DELETE /ticket-grants/{id}` · `POST /workspaces/{ws}/ticket-delegations` · `DELETE /ticket-delegations/{id}` · `PUT /workspaces/{ws}/ticket-ai-delegation` |
| Thông báo, nhật ký | `GET /me/notifications` · `GET /me/notifications/unread-count` · `POST /me/notifications/{id}/read` · `/read-all` · `GET /workspaces/{ws}/audit` · `GET /admin/audit` |
| Quản trị | `GET /admin/users` · `PATCH /admin/users/{id}` |
| Hệ thống | `GET /api/v1/meta` · `GET /healthz` · `GET /readyz` (ping MongoDB) |

### AI (ticket)

`AI_PROVIDER=anthropic` gọi Claude (`AI_MODEL`, mặc định `claude-opus-5-5`) qua Messages API với JSON có schema
(`output_config.format`), thử lại khi 429 / 5xx / 529, xử lý `stop_reason: refusal`. Mặc định bật
`fallbacks: "default"` (`AI_FALLBACKS=true`): yêu cầu bị bộ lọc an toàn từ chối được chạy lại phía máy chủ Anthropic
trên model dự phòng; tắt bằng `AI_FALLBACKS=false`. Dữ liệu gửi đi chỉ gồm ticket và tài liệu mà **người được AI thay mặt**
xem được tại lúc chạy. `AI_PROVIDER=none`: kiểm tra trùng bằng so khớp từ khoá, đề xuất tài liệu theo mã truy vết – không
gửi dữ liệu ra ngoài.

## Triển khai

Build bản phát hành: `cargo build --release -p chillcat-server` → một file chạy `target/release/chillcat-server`, mẫu tài liệu
đã nhúng sẵn. Đặt cạnh thư mục giao diện (gốc repo) và trỏ `STATIC_DIR` tới đó, hoặc đặt giao diện sau reverse proxy và chỉ
chuyển `/api/` cho máy chủ. Kiểm tra sống / sẵn sàng: `/healthz`, `/readyz`. Log JSON: `LOG_FORMAT=json`.

### Docker

[Dockerfile](Dockerfile) dựng ảnh chứa máy chủ + giao diện (build từ gốc repo: `docker build -f backend/Dockerfile .`;
[Dockerfile.dockerignore](Dockerfile.dockerignore) loại `target/`, `.dev/`, `.git`, `.env` khỏi ngữ cảnh build). Ảnh chạy
bằng người dùng không phải root, cổng 8080, có `HEALTHCHECK` gọi `/healthz`.

Trọn bộ trên một máy nội bộ (MongoDB replica set một node + máy chủ) – [deploy/docker-compose.yml](deploy/docker-compose.yml):

```powershell
cd backend/deploy
copy .env.example .env          # đặt JWT_SECRET (>= 32 ký tự)
docker compose up -d --build    # → http://localhost:8080
docker compose logs -f app      # log JSON
docker compose down             # dừng; dữ liệu nằm trong volume chillcat_mongo-data (down -v để xoá)
```

Container `mongo` tự khởi tạo replica set `rs0` ở lần chạy đầu (healthcheck), `app` chỉ khởi động khi đã có primary.
Dùng Atlas: đặt `MONGODB_URI=mongodb+srv://…` trong `deploy/.env` rồi `docker compose up -d --build --no-deps app`.
Compose nằm ở thư mục riêng để không đọc nhầm `backend/.env` của máy phát triển.
