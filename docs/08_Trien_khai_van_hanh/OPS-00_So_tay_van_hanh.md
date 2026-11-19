# Sổ tay vận hành

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | CCS-OPS-000 |
| Phiên bản | 0.1 |
| Ngày | 2026-11-18 |
| Trạng thái | Dự thảo – viết từ hệ thống đang chạy |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.12 Operation · 6.4.13 Maintenance |
| Chuẩn tham chiếu | ISO/IEC/IEEE 15289 (hạng mục thông tin loại *procedure*) |
| Hệ thống con | HUB – Làm việc nhóm (EDT chỉ có phần phát hành lên GitHub Pages: [DEP-00 §6.2](DEP-00_Trien_khai_tong_the.md)) |
| Nguồn đã khảo sát | `backend/README.md`, `backend/Dockerfile`, `backend/deploy/docker-compose.yml`, `backend/deploy/.env.example`, `backend/.env.example`, `backend/.gitignore`, `backend/Dockerfile.dockerignore`, `backend/scripts/dev-mongo.ps1`, `backend/apps/server/src/main.rs`, `backend/apps/server/src/app.rs`, `backend/crates/platform/src/{config,mongo,outbox,jwt,http,module}.rs`, `backend/crates/identity/src/{lib,service,model,http}.rs`, `backend/crates/documents/src/{lib,integration}.rs`, `backend/crates/tickets/src/{lib,runs,ai,model}.rs`, `backend/crates/audit/src/lib.rs`, `backend/crates/notifications/src/lib.rs`, `backend/crates/workspaces/src/members.rs`, `js/api.js`, `js/hub.js`, `sw.js` |
| Đơn vị ban hành | Nhóm phát triển ChillCat Studio |
| Tài liệu liên quan | ↑ [DEP-00](DEP-00_Trien_khai_tong_the.md) (không lập DEP theo hệ thống con – [LCP-00 §3.3](../00_Quan_ly_tai_lieu/LCP-00_Ke_hoach_vong_doi_phan_mem.md)) · [StRS-00 §3](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) (StR-24 – StR-29) · [SyRS-00 §5–§6](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) · [BMA-00 §5](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md) (BP-24, BP-41, BP-42) · ↓ [ASM-00 §9](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) · ⇄ [SAD-00 §6](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) · [ERD-HUB §3](../05_Thiet_ke_du_lieu/ERD-HUB_CSDL_Lam_viec_nhom.md) · [STP-00](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) |

---

**Mục đích và phạm vi.** Sổ tay cho người trực vận hành máy chủ HUB chạy bằng Docker Compose (`backend/deploy/`) – với MongoDB đi kèm hoặc MongoDB Atlas: lệnh chạy được ngay, dấu hiệu → nguyên nhân → cách xử lý. Cách dựng, cấu hình, nâng cấp, quay lui: [DEP-00](DEP-00_Trien_khai_tong_the.md). Đây là nơi định nghĩa mã sự cố `OP-nn` ([CONV §3.4](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md)); sự cố lặp lại được đưa sang [ASM-00 §9](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) thành rủi ro.

**Quy ước lệnh.** Lệnh `docker compose …` chạy trong thư mục `backend/deploy/`. Lệnh MongoDB gõ tại dấu nhắc của mongosh mở bằng `docker compose exec mongo mongosh chillcat` (Atlas: mongosh với `MONGODB_URI`); gõ trực tiếp như vậy tránh lỗi trích dẫn của PowerShell 5.1. Thao tác thẳng vào CSDL **không đi qua nhật ký** của hệ thống – ghi lại bằng tay mỗi lần làm. Lệnh có nhãn **(suy luận)** chưa được diễn tập trên hệ thống này.

## 1. Lệnh hằng ngày

| Muốn | Chạy |
|---|---|
| Xem các dịch vụ còn chạy không | `docker compose ps` – đúng là `app` và `mongo` đều `Up … (healthy)` |
| Kiểm tra sống / sẵn sàng | `curl -s http://localhost:8080/healthz` → `ok`; `curl -s http://localhost:8080/readyz` → `ready` (PowerShell: `curl.exe` hoặc `Invoke-RestMethod`) |
| Xem bản đang chạy | `curl -s http://localhost:8080/api/v1/meta` (`version`, `ai`, `public_base_url`; không lộ bí mật) |
| Khởi động lại máy chủ | `docker compose restart app` |
| Khởi động lại cả bộ | `docker compose restart` |
| Dừng / chạy lại, giữ dữ liệu | `docker compose down` / `docker compose up -d` (Atlas: `docker compose up -d --no-deps app`) |
| Xem log gần nhất | `docker compose logs --tail 200 app`; theo dõi liên tục: `docker compose logs -f app`; theo thời gian: `docker compose logs --since 1h app` |
| Lọc dòng lỗi / cảnh báo | PowerShell: `docker compose logs app \| Select-String '"level":"(ERROR\|WARN)"'`; bash: `docker compose logs app \| grep -E '"level":"(ERROR\|WARN)"'` |
| Xem log MongoDB | `docker compose logs --tail 100 mongo` |
| Xem tài nguyên | `docker stats --no-stream`; dung lượng Docker: `docker system df` |
| Mở shell CSDL | `docker compose exec mongo mongosh chillcat` |
| Máy phát triển | `powershell -ExecutionPolicy Bypass -File backend/scripts/dev-mongo.ps1` (dừng: `-Stop`); `cargo run -p chillcat-server` trong `backend/` |

### 1.1 Quản trị viên đầu tiên

Quản trị hệ thống (SH-ADM) quản lý tài khoản và xem nhật ký hệ thống, nhưng **không** mặc nhiên xem tài liệu hay ticket của dự án – đó là nguyên tắc đặc quyền tối thiểu (SYS-N01), không phải hạn chế.

| Cách | Làm gì | Hệ thống làm gì | Nguồn |
|---|---|---|---|
| Biến môi trường | Đặt cả `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` trước lần khởi động đầu | Khi khởi động, nếu **chưa có quản trị viên nào**: e-mail đã có tài khoản ⇒ nâng tài khoản đó lên quản trị (mật khẩu giữ nguyên); chưa có ⇒ tạo tài khoản "Quản trị Hệ thống" với mật khẩu đã đặt. Log: `Đã tạo tài khoản quản trị viên đầu tiên` hoặc `Đã nâng tài khoản có sẵn thành quản trị viên`. Đã có quản trị viên ⇒ bỏ qua | `backend/crates/identity/src/service.rs#bootstrap_admin` |
| Người đăng ký đầu tiên | Không đặt hai biến trên; đăng ký ngay sau khi triển khai, trước khi mở cho người khác và trước khi chạy script thử | Người đăng ký khi collection `users` còn trống trở thành quản trị | `service.rs#register` |

- Sau khi tạo bằng biến môi trường: đổi mật khẩu trong ứng dụng rồi xoá `BOOTSTRAP_ADMIN_PASSWORD` khỏi `backend/deploy/.env` (biến không còn tác dụng khi đã có quản trị viên).
- `AUTH_ALLOW_REGISTRATION=false` mà không đặt `BOOTSTRAP_ADMIN_*` ⇒ không ai tạo được tài khoản đầu tiên **(suy luận)** từ `service.rs#register`.
- Thêm quản trị viên: quản trị viên hiện có đổi vai trò ở trang **Quản trị hệ thống** (§1.2). Không còn quản trị viên nào đăng nhập được: OP-13.

### 1.2 Khoá / mở khoá tài khoản, vai trò quản trị

- **Giao diện:** tab **Dự án** → **Quản trị hệ thống** (chỉ hiện với quản trị viên, `js/hub.js`): danh sách tài khoản, chọn vai trò Người dùng / Quản trị, nút khoá / mở.
- **API:** `GET /api/v1/admin/users?q=…`; `PATCH /api/v1/admin/users/{id}` với `{"disabled": true}` / `{"disabled": false}` hoặc `{"system_role": "admin"}` / `{"system_role": "user"}` (`backend/crates/identity/src/service.rs#admin_update`). Nhật ký hệ thống: `GET /api/v1/admin/audit` (giao diện chưa có trang riêng cho nhật ký hệ thống; trang **Nhật ký** trong tab Dự án là nhật ký workspace).
- **Khoá** ⇒ mọi phiên của người đó bị thu hồi; đăng nhập và làm mới phiên trả `auth.disabled` ("Tài khoản đã bị khoá – liên hệ quản trị viên"). Access token đã cấp trước đó vẫn dùng được tới khi hết hạn (tối đa `ACCESS_TOKEN_TTL_SECS`, mặc định 15 phút), vì token được kiểm tại chỗ, không đối chiếu phiên **(suy luận)** từ `backend/crates/platform/src/jwt.rs#verify`.
- Mỗi lần khoá, mở, đổi vai trò sinh sự kiện có cờ nhật ký (`USER_DISABLED`, `USER_ENABLED`, `USER_ROLE_CHANGED`).
- Không tự khoá hay tự bỏ quyền quản trị của mình (`user.self_demote`).
- Khác với khoá đăng nhập tạm 5 phút sau 5 lần sai mật khẩu (`auth.locked`) – tự hết, xem OP-14.

### 1.3 Dọn dẹp ổ đĩa

| Dọn gì | Lệnh | Lưu ý |
|---|---|---|
| Xem cái gì chiếm chỗ | `docker system df` | – |
| Ảnh lơ lửng (`<none>`) | `docker image prune` | Cũng xoá ảnh cũ còn dùng được để quay lui nếu chưa gắn thẻ ([DEP-00 §6.1.4](DEP-00_Trien_khai_tong_the.md)) |
| Cache build (Cargo registry, `target`) | `docker builder prune` (giữ cache gần đây: `docker builder prune --filter until=168h`) | Giải phóng nhiều nhất, nhưng lần build sau mất ~17 phút như build đầu |
| Log của container `app` | Tạo lại container: `docker compose up -d --force-recreate app` | Log của driver mặc định không tự xoay vòng và mất khi container bị tạo lại **(suy luận)** |
| Máy phát triển | `cargo clean` trong `backend/`; xoá `backend/.dev/log/` | `backend/.dev/data/` là dữ liệu MongoDB cục bộ |
| **Không bao giờ** | `docker compose down -v`, `docker volume prune`, `docker system prune --volumes` | Xoá volume `chillcat_mongo-data` – mất toàn bộ dữ liệu |

MongoDB tự dọn dữ liệu quá hạn bằng chỉ mục TTL và tác vụ định kỳ (§2).

### 1.4 Nâng cấp phụ thuộc (bảo trì)

| Phụ thuộc | Đang cố định ở | Cách nâng | Kiểm tra sau khi nâng |
|---|---|---|---|
| Crate Rust | `backend/Cargo.lock`; ảnh build bằng `cargo build --locked`; Rust ≥ 1.85 (`rust-version`) | Trên máy phát triển: `cargo update` (hoặc `cargo update -p <crate>`), commit `Cargo.lock` | `cargo test --workspace`, `cargo clippy --workspace --all-targets`, `smoke.mjs`, `backend/scripts/e2e/` ([STP-00](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md)); rồi phát hành theo [DEP-00 §6.1.3](DEP-00_Trien_khai_tong_the.md) |
| Ảnh nền `rust:1-bookworm`, `debian:bookworm-slim` | Thẻ trôi | `docker compose build --pull` rồi `docker compose up -d` | §6.1.6 của DEP-00 |
| `mongo:8.0` | Thẻ trôi trong dòng 8.0 | `docker compose pull mongo` rồi `docker compose up -d mongo` (sao lưu trước – §4) | `docker compose ps`, `/readyz` |
| MongoDB bản lớn (8.0 → bản sau) | – | Chưa có quy trình (§9) | – |
| MongoDB máy phát triển | Bản 8.0 mới nhất lúc tải lần đầu (`dev-mongo.ps1`) | Dừng (`-Stop`), xoá `backend/.dev/mongodb/`, chạy lại script; dữ liệu ở `backend/.dev/data/` giữ nguyên **(suy luận)** | `cargo test --workspace` |
| `puppeteer-core` (kiểm thử giao diện) | `^24.43.1` trong `backend/scripts/e2e/package.json` | `npm update` trong `backend/scripts/e2e/` | `node ui.mjs`, `node ui-team.mjs` |
| Thư viện CDN của EDT | Số phiên bản trong URL + mã toàn vẹn (SRI), ví dụ `js/md-rich.js` | Sửa URL và mã `integrity` cùng lúc | Mở tài liệu có Mermaid / KaTeX / mã nguồn |
| Model Claude | `AI_MODEL` (mặc định `claude-opus-5-5`) | Đổi biến, `docker compose up -d` | `/api/v1/meta` trả `ai_model` mới; chạy thử kiểm tra trùng một ticket |

## 2. Việc chạy theo lịch

Tác vụ của máy chủ chạy lần đầu 20 giây sau khi khởi động rồi lặp theo chu kỳ (`backend/apps/server/src/app.rs#spawn_jobs`, [DEP-00 §3.1](DEP-00_Trien_khai_tong_the.md)). Chỉ mục TTL do MongoDB tự xoá (bộ quét TTL của MongoDB chạy khoảng 60 giây một lần). Truy vấn kiểm tra gõ ở mongosh.

| Việc | Lúc nào | Ở đâu | Nếu không chạy thì | Kiểm tra bằng |
|---|---|---|---|---|
| Outbox relay | Liên tục | HUB, cùng tiến trình | Thông báo, nhật ký, cờ Cần rà soát, phản ứng ticket chậm hoặc không có (OP-09) | Log `Outbox relay bắt đầu` lúc khởi động; `db.outbox.countDocuments({dispatched_at: null, failed_at: null})` gần 0; `db.outbox.countDocuments({failed_at: {$ne: null}})` = 0 |
| `documents.purge_expired_versions` | 24 giờ | HUB | Bản Thay thế quá hạn ở lại lâu hơn; không ảnh hưởng việc chạy | Log `Đã xoá phiên bản quá hạn lưu` (chỉ khi có bản bị xoá); `db.document_versions.countDocuments({status: "superseded", superseded_at: {$lt: new Date(Date.now() - 3652*86400000)}})` = 0 |
| `identity.purge_sessions` | 6 giờ | HUB | Collection `sessions` lớn dần | `db.sessions.countDocuments({revoked_at: {$lt: new Date(Date.now() - 7*86400000)}})` = 0 |
| `tickets.fail_stuck_checks` | 5 phút | HUB | Ticket kẹt ở "Đang kiểm tra trùng" (OP-08) | `db.ticket_ai_checks.countDocuments({status: "pending", created_at: {$lt: new Date(Date.now() - 20*60000)}})` = 0 (15 phút + một chu kỳ) |
| TTL `audit_ttl` – `audit_logs.created_at` | MongoDB tự chạy | MongoDB | Nhật ký giữ quá hạn | `db.audit_logs.getIndexes()` có `audit_ttl`, `expireAfterSeconds` = `AUDIT_RETENTION_DAYS` × 86400 (mặc định 63072000) |
| TTL `notifications_ttl` – `notifications.created_at` | MongoDB tự chạy | MongoDB | Thông báo giữ quá 180 ngày | `db.notifications.getIndexes()`: `expireAfterSeconds` = 15552000 |
| TTL `sessions_expire` – `sessions.expires_at` | MongoDB tự chạy | MongoDB | Phiên hết hạn còn trong CSDL (vẫn bị từ chối khi làm mới) | `db.sessions.getIndexes()` |
| TTL `outbox_dispatched_ttl` – `outbox.dispatched_at` | MongoDB tự chạy | MongoDB | Collection `outbox` lớn dần | `db.outbox.getIndexes()`: `expireAfterSeconds` = 604800 |
| Healthcheck `app` (30 s) và `mongo` (10 s) | Docker | Docker | Không thấy trạng thái thật trên `docker compose ps` | `docker compose ps`. Docker **không** tự khởi động lại container `unhealthy`; `restart: unless-stopped` chỉ khởi động lại khi tiến trình thoát |
| Sao lưu | **Không có lịch** – hệ thống chưa có chức năng sao lưu tích hợp (StR-29) | – | Mất dữ liệu khi hỏng ổ đĩa hoặc xoá nhầm volume | §4 |

Collection nằm trong CSDL `MONGODB_DB` (mặc định `chillcat`), trừ khi đã tách bằng `MONGODB_DB_<MODULE>` ([DEP-00 §5](DEP-00_Trien_khai_tong_the.md)).

### 2.1 Thời hạn lưu dữ liệu

| Dữ liệu | Giữ | Đổi bằng | Cơ chế | Nguồn |
|---|---|---|---|---|
| Phiên bản ở trạng thái Thay thế (`document_versions`), kèm nhận xét, lượt duyệt, chỉ mục truy vết | 10 năm kể từ `superseded_at` | `VERSION_RETENTION_YEARS` (đổi lúc nào cũng được) | Tác vụ 24 giờ | `backend/crates/documents/src/integration.rs#purge_expired_versions`; StC-08, SYS-N10 |
| Nhật ký `audit_logs` | 730 ngày kể từ lúc ghi từng dòng (mốc chưa chốt – quyết định #30) | `AUDIT_RETENTION_DAYS` (cẩn thận: OP-19; compose không truyền biến này) | Chỉ mục TTL | `backend/crates/audit/src/lib.rs` |
| Thông báo `notifications` | 180 ngày | Không đổi được (hằng số trong mã) | Chỉ mục TTL | `backend/crates/notifications/src/lib.rs` |
| Lời mời `invitations` | Hiệu lực 14 ngày | `INVITATION_TTL_DAYS` | Không bị xoá. Quá hạn thì không nhận được; chuyển trạng thái `expired` khi có lời mời mới cho cùng người, cùng phạm vi | `backend/crates/workspaces/src/members.rs` |
| Phiên `sessions` | Tới `expires_at` (`REFRESH_TOKEN_TTL_DAYS`, 30 ngày); phiên đã thu hồi xoá sau 7 ngày | `REFRESH_TOKEN_TTL_DAYS` | Chỉ mục TTL + tác vụ 6 giờ | `backend/crates/identity/src/service.rs` |
| Sự kiện `outbox` đã phát | 7 ngày | Không đổi được | Chỉ mục TTL; sự kiện hỏng (`failed_at`) giữ mãi | `backend/crates/platform/src/outbox.rs` |
| Tài liệu, ticket, lần chạy AI, thành viên | Không tự xoá | – | – | – |

Việc xoá theo hạn không để lại dòng nhật ký nào (đánh giá ở [CMP-00](../09_Danh_gia_hien_trang/CMP-00_Danh_gia_tuan_thu_15289.md)).

## 3. Khi có sự cố

Thông báo lỗi ghi trong ngoặc kép là chuỗi thật trong log hoặc phản hồi API. Lỗi khởi động đi kèm dòng `Không khởi động được máy chủ`; container `app` khi đó ở trạng thái `Restarting` (`restart: unless-stopped`).

| Mã | Dấu hiệu | Có thể do | Làm gì | Liên quan |
|---|---|---|---|---|
| OP-01 | Máy chủ không khởi động: sau ~10 giây log "Không kết nối được MongoDB – kiểm tra MONGODB_URI và mạng (Atlas: danh sách IP được phép)"; hoặc "MONGODB_URI không hợp lệ: …" | Container `mongo` chưa chạy hoặc chưa healthy; `MONGODB_URI` sai; mạng; Atlas chặn (OP-03); biến của shell ghi đè (OP-04) | `docker compose ps mongo`, `docker compose logs --tail 50 mongo`; kiểm `MONGODB_URI` trong `backend/deploy/.env` (bỏ trống = dùng container `mongo`); `docker compose up -d` | SYS-I01, SYS-N06, [DEP-00 §5](DEP-00_Trien_khai_tong_the.md) |
| OP-02 | Máy chủ không khởi động: "MongoDB phải chạy dạng replica set (cần transaction)…" | mongod chạy đơn lẻ (không `--replSet`) hoặc replica set chưa khởi tạo | Docker: healthcheck của `mongo` tự `rs.initiate` – xem `docker compose logs mongo`, kiểm bằng mongosh `rs.status()`. Máy phát triển: chạy lại `dev-mongo.ps1` (tự khởi tạo) hoặc đặt `MONGODB_AUTO_INIT_REPLICA_SET=true` (chỉ máy phát triển). Linux / macOS: `mongod --replSet rs0` rồi `rs.initiate()` | StC-02, SYS-N05 |
| OP-03 | Như OP-01 khi `MONGODB_URI` là `mongodb+srv://…` | IP của máy chạy `app` chưa có trong **Network Access** của Atlas; sai người dùng / mật khẩu CSDL; máy không phân giải được bản ghi DNS SRV | Thêm IP công khai (hoặc VPC) của máy vào Network Access; kiểm người dùng có `readWrite` trên CSDL; thử phân giải `_mongodb._tcp.<cụm>.mongodb.net` (`nslookup -type=SRV`); `docker compose up -d --no-deps app` | SYS-I01, SYS-N09, StR-27, [DEP-00 §6.1.5](DEP-00_Trien_khai_tong_the.md) |
| OP-04 | Container `app` báo lỗi như OP-01 dù `mongo` healthy; lỗi nhắc tới `127.0.0.1:27117` | Shell đang có `MONGODB_URI` của máy phát triển; biến của shell được ưu tiên hơn `backend/deploy/.env` | PowerShell: `Get-ChildItem Env:MONGODB*` rồi `Remove-Item Env:MONGODB_URI`; bash: `unset MONGODB_URI`; chạy lại `docker compose up -d` (tạo lại `app`). Kiểm cả các biến khác trùng tên với `.env` | [DEP-00 §6.1.6](DEP-00_Trien_khai_tong_the.md) (Lưu ý) |
| OP-05 | Máy chủ không khởi động: "Cấu hình không hợp lệ: JWT_SECRET phải dài ít nhất 32 ký tự" / "… bắt buộc ở môi trường prod" / "AI_API_KEY bắt buộc khi AI_PROVIDER=anthropic" / "<BIẾN> = "…" không đọc được" / "… phải là true / false"; hoặc compose từ chối chạy: "Đặt JWT_SECRET (ít nhất 32 ký tự) trong backend/deploy/.env" | Thiếu hoặc sai giá trị trong `backend/deploy/.env` | Sửa `.env` theo [DEP-00 §5](DEP-00_Trien_khai_tong_the.md); `docker compose up -d` | SYS-N02, `backend/crates/platform/src/config.rs#from_env` |
| OP-06 | `docker compose up` báo cổng đã bị dùng ("port is already allocated"); hoặc máy chủ báo "Không mở được cổng …" | Tiến trình khác giữ cổng 8080 (thường là `cargo run` trên máy phát triển) | Tìm tiến trình: PowerShell `Get-NetTCPConnection -LocalPort 8080`; dừng nó, hoặc đặt `APP_PORT` khác (và `PUBLIC_BASE_URL` tương ứng) trong `.env` | `backend/apps/server/src/main.rs#run` |
| OP-07 | `/readyz` trả `503 mongo unavailable`; log WARN "MongoDB chưa sẵn sàng"; API trả lỗi 5xx, log ERROR "Lỗi khi xử lý yêu cầu" | Container `mongo` dừng hoặc thiếu bộ nhớ; ổ đĩa đầy (OP-10); Atlas đang bảo trì hoặc đổi primary | `docker compose ps mongo`, `docker compose logs --tail 100 mongo`, `docker compose up -d mongo`; Atlas: xem trạng thái cụm. Máy chủ tự nối lại khi MongoDB trả lời, không cần khởi động lại `app` **(suy luận)**. `/healthz` không chạm CSDL nên `app` vẫn `healthy` | SYS-N06, `app.rs#readyz` |
| OP-08 | Ticket nằm lâu ở "Đang kiểm tra trùng"; lần chạy AI "thất bại"; log ERROR "Chạy AI cho ticket thất bại", WARN "Dịch vụ AI bận / lỗi tạm thời – thử lại" | Máy chủ khởi động lại giữa lần chạy; quá `AI_TIMEOUT_SECS` (300 s); `AI_API_KEY` sai hoặc bị thu hồi; `AI_MODEL` không tồn tại; mạng tới `AI_BASE_URL`; nhà cung cấp quá tải (429 / 529) | Lần chạy treo quá 15 phút được `tickets.fail_stuck_checks` đánh dấu thất bại (chậm nhất ~20 phút) và ticket trở về trạng thái trước; sau đó người có quyền xem + xử lý ticket chạy lại. Xem lần chạy treo: `db.ticket_ai_checks.find({status: "pending"})`. Đọc log để tìm nguyên nhân; kiểm khoá, model. Tạm thời có thể đặt `AI_PROVIDER=none` (so khớp từ khoá, không gửi dữ liệu ra ngoài) rồi `docker compose up -d` | SYS-I02, StR-21, BP-32, `backend/crates/tickets/src/runs.rs#fail_stuck_checks` |
| OP-09 | Thông báo không tới, cờ Cần rà soát không hiện, nhật ký thiếu dòng; log WARN "Handler xử lý sự kiện thất bại" (kèm `handler`, `kind`, `event_id`), ERROR "Sự kiện hỏng sau nhiều lần thử – giữ lại trong outbox để kiểm tra", ERROR "Outbox relay gặp lỗi khi đọc sự kiện" | Handler lỗi vì dữ liệu hoặc CSDL; MongoDB mất kết nối; tiến trình dừng | Đếm như §2; xem sự kiện hỏng: `db.outbox.find({failed_at: {$ne: null}}, {kind: 1, attempts: 1, last_error: 1, done: 1})`. Sửa nguyên nhân, rồi cho phát lại: `db.outbox.updateMany({failed_at: {$ne: null}}, {$set: {failed_at: null, attempts: 0, available_at: new Date()}})` – handler đã xong (`done`) sẽ được bỏ qua **(suy luận, chưa diễn tập)**. Nhiều sự kiện chờ mà không có lỗi: `docker compose restart app` | SYS-N05, SYS-N11, `backend/crates/platform/src/outbox.rs#dispatch_next` |
| OP-10 | Build báo "no space left on device"; MongoDB không ghi được, container `mongo` dừng; API 5xx | Cache build, ảnh cũ, log container không xoay vòng **(suy luận)**, dữ liệu MongoDB, bản sao lưu cất cùng ổ | `docker system df`; dọn theo §1.3 (`docker builder prune`, `docker image prune`); chuyển bản sao lưu ra ngoài máy. **Không** xoá volume | §1.3 |
| OP-11 | `docker compose up -d --build` dừng giữa bước `cargo build`; Docker Desktop sập hoặc tự khởi động lại | Máy 8 GB RAM chỉ còn trống ~1,5 GB; nhiều `rustc` chạy song song (đã gặp) | Đặt `CARGO_BUILD_JOBS=2` trong `backend/deploy/.env`; đóng ứng dụng khác; khởi động lại Docker Desktop rồi build lại (lâu hơn nhưng xong) | [DEP-00 §6.1.1](DEP-00_Trien_khai_tong_the.md) |
| OP-12 | Người dùng quên mật khẩu, không đăng nhập được | Hệ thống **chưa có** tự đặt lại mật khẩu, quản trị viên cũng không đặt lại được (`PATCH /api/v1/admin/users/{id}` chỉ đổi `disabled`, `system_role`); không gửi e-mail | Chưa có cách xử lý trong hệ thống (§9). Tạm thời **(suy luận)**: người dùng đăng ký tài khoản mới bằng e-mail khác, được mời lại vào workspace / group và cấp lại quyền; quản trị viên khoá tài khoản cũ. Không sửa `password_hash` bằng tay | StR-26, SYS-F10, BP-41 |
| OP-13 | Không còn quản trị viên nào đăng nhập được | Quản trị viên duy nhất quên mật khẩu (OP-12) hoặc bị khoá / hạ vai trò; `BOOTSTRAP_ADMIN_*` chỉ có tác dụng khi chưa có quản trị viên nào | Nâng một tài khoản khác bằng mongosh: `db.users.updateOne({email: "<e-mail>"}, {$set: {system_role: "admin"}})`; vai trò mới có trong token từ lần làm mới phiên kế tiếp (≤ 15 phút) hoặc khi đăng nhập lại **(suy luận, chưa diễn tập)**. Ghi lại thao tác vì nó không vào nhật ký | StR-25, SYS-N01, §1.1 |
| OP-14 | Đăng nhập báo "Đăng nhập sai quá nhiều lần – thử lại sau ít phút" (`auth.locked`) | 5 lần sai mật khẩu liên tiếp ⇒ khoá đăng nhập 5 phút | Chờ 5 phút. Cần mở sớm: `db.users.updateOne({email: "<e-mail>"}, {$set: {locked_until: null, failed_logins: 0}})` **(suy luận)**. Khác với tài khoản bị quản trị viên khoá (`auth.disabled`, §1.2) | StR-26, SYS-N02 |
| OP-15 | `JWT_SECRET` bị lộ (thấy trong commit, ảnh, nhật ký trò chuyện…) | – | Ai có khoá ký được access token cho bất kỳ người dùng và vai trò nào, kể cả quản trị, vì token được kiểm tại chỗ **(suy luận)**. 1) Sinh khoá mới, sửa `.env`, `docker compose up -d` ⇒ mọi access token cũ, kể cả token giả, mất hiệu lực ngay (§5). 2) Muốn mọi người đăng nhập lại: `db.sessions.updateMany({revoked_at: null}, {$set: {revoked_at: new Date()}})`. 3) Xem nhật ký hệ thống và workspace trong khoảng bị lộ – thao tác bằng token giả mang tên người bị mạo danh. 4) Tìm chỗ lộ | SYS-N02, §5 |
| OP-16 | `AI_API_KEY` hoặc mật khẩu người dùng CSDL Atlas bị lộ | – | Thu hồi / đổi ở nhà cung cấp (Anthropic Console; Atlas Database Access), sửa `.env`, khởi động lại `app` (§5); Atlas: thu hẹp Network Access | SYS-I01, SYS-I02 |
| OP-17 | Đăng nhập được nhưng mỗi lần tải lại trang phải đăng nhập lại | `PUBLIC_BASE_URL` bắt đầu bằng `https://` trong khi người dùng mở bằng `http://`: cookie `cc_refresh` có cờ `Secure` nên trình duyệt không gửi lại **(suy luận)** | Đặt `PUBLIC_BASE_URL` đúng địa chỉ người dùng mở; muốn HTTPS thì đặt reverse proxy TLS phía trước ([DEP-00 §4](DEP-00_Trien_khai_tong_the.md)) | SYS-N02, `backend/apps/server/src/app.rs#build` (`cookie_secure`) |
| OP-18 | Mở giao diện từ tên miền khác máy chủ (ví dụ `https://design.trungctr.com`), tab Dự án báo "Không kết nối được máy chủ – kiểm tra mạng hoặc địa chỉ máy chủ"; console trình duyệt báo CORS hoặc mixed content | `CORS_ALLOWED_ORIGINS` thiếu origin của giao diện; trang `https://` gọi máy chủ `http://` bị trình duyệt chặn **(suy luận)**; địa chỉ máy chủ đặt sai ở tab Dự án | Thêm origin (ví dụ `https://design.trungctr.com`) vào `CORS_ALLOWED_ORIGINS`, `docker compose up -d`; phục vụ máy chủ qua HTTPS; kiểm địa chỉ máy chủ trong tab Dự án | SYS-I05, `js/api.js#API.setBase` |
| OP-19 | Sau khi đổi `AUDIT_RETENTION_DAYS`, máy chủ không khởi động: "Khởi tạo module audit thất bại: Không tạo được chỉ mục cho collection `audit_logs`: …" **(suy luận, chưa thử)** | Chỉ mục `audit_ttl` đã có với thời hạn cũ; MongoDB từ chối tạo lại cùng tên khác tuỳ chọn | mongosh: `db.runCommand({collMod: "audit_logs", index: {name: "audit_ttl", expireAfterSeconds: <số ngày × 86400>}})` rồi khởi động lại; hoặc đặt lại giá trị cũ. Với compose, biến này phải được thêm vào `environment:` mới tới được container | SYS-N10, [DEP-00 §7](DEP-00_Trien_khai_tong_the.md) |
| OP-20 | Sau khi phát hành EDT, bản offline thiếu file mới hoặc service worker không cập nhật | `PRECACHE` trong `sw.js` liệt kê file không tồn tại ⇒ lần cài service worker thất bại **(suy luận)**; quên tăng `VERSION` | DevTools → Application → Service Workers xem lỗi cài; sửa `PRECACHE` cho khớp file có thật, tăng `VERSION`, đẩy lại `main` | SYS-N13, [DEP-00 §6.2](DEP-00_Trien_khai_tong_the.md) |

## 4. Sao lưu và khôi phục

**Hệ thống chưa có chức năng sao lưu tích hợp** (StR-29, mức đáp ứng "Chưa có"; SyRS-00 §2.3 xếp sao lưu vào phần hạ tầng; BP-42 bước 4). Không có lịch, chưa có nơi cất được chỉ định, chưa có người chịu trách nhiệm, chưa từng khôi phục thử. Các cách dưới dùng công cụ của MongoDB, Docker, Atlas và **chưa được diễn tập** trên hệ thống này.

| Dữ liệu | Cách sao lưu | Bao lâu một lần | Lần thử khôi phục gần nhất | Còn thiếu |
|---|---|---|---|---|
| CSDL `chillcat` trong container `mongo` (volume `chillcat_mongo-data`) | `mongodump` trong container rồi chép ra ngoài (§4.1) | Chưa quy định | Chưa từng | Lịch tự động, nơi cất ngoài máy, người chịu trách nhiệm, lần khôi phục thử |
| CSDL trên MongoDB Atlas | Cloud Backup của Atlas, hoặc `mongodump --uri` (§4.2) | Theo chính sách sao lưu của cụm – chưa cấu hình | Chưa từng | Chưa chọn gói, chưa đặt thời hạn giữ |
| `backend/deploy/.env` (cấu hình, bí mật) | Chép tay vào kho bí mật của tổ chức | Mỗi lần đổi | – | Chưa chỉ định kho bí mật |
| Ảnh `chillcat-studio` | Không sao lưu; dựng lại từ mã | – | – | `backend/` chưa nằm trong git ⇒ chưa dựng lại được bản cũ ([DEP-00 §6.1.4](DEP-00_Trien_khai_tong_the.md)) |
| Dữ liệu EDT của người dùng (`localStorage`) | Người dùng tự lưu file `.md` / `.json` | – | – | Ngoài phạm vi vận hành máy chủ |

### 4.1 Container `mongo`: sao lưu và khôi phục (suy luận, chưa diễn tập)

Sao lưu – dừng `app` để mọi collection cùng một thời điểm, rồi chép bản sao ra một thư mục **ngoài repo**:

```powershell
cd backend/deploy
docker compose stop app
docker compose exec mongo mongodump --db chillcat --gzip --archive=/tmp/chillcat.archive.gz
docker compose cp mongo:/tmp/chillcat.archive.gz <thư-mục-sao-lưu>/chillcat-<ngày>.archive.gz
docker compose exec mongo rm /tmp/chillcat.archive.gz
docker compose start app
```

Khôi phục – `--drop` xoá collection hiện có trước khi nạp:

```powershell
cd backend/deploy
docker compose cp <thư-mục-sao-lưu>/chillcat-<ngày>.archive.gz mongo:/tmp/restore.archive.gz
docker compose stop app
docker compose exec mongo mongorestore --gzip --archive=/tmp/restore.archive.gz --drop --nsInclude "chillcat.*"
docker compose exec mongo rm /tmp/restore.archive.gz
docker compose start app
```

- Đã tách CSDL bằng `MONGODB_DB_<MODULE>`: bỏ `--db chillcat` (lấy mọi CSDL) hoặc lặp lệnh cho từng CSDL; đổi `--nsInclude` tương ứng.
- Không dùng `docker compose exec -T mongo mongodump --archive > file` trong Windows PowerShell 5.1: toán tử `>` đổi dữ liệu nhị phân thành văn bản và làm hỏng file.
- Sau khi khôi phục, CSDL trở về thời điểm sao lưu, kể cả phiên đăng nhập; sự kiện chưa phát trong bản sao được relay phát lại. Thông báo không bị nhân đôi nhờ chỉ mục duy nhất `notifications_event_user` **(suy luận)**.
- Cách khác: sao chép nguyên volume khi cả bộ đã dừng (`docker compose down`), ví dụ `docker run --rm -v chillcat_mongo-data:/data -v <thư-mục-sao-lưu>:/backup debian:bookworm-slim tar czf /backup/mongo-data-<ngày>.tgz -C /data .`.

### 4.2 MongoDB Atlas

- **Cloud Backup** của Atlas (ảnh chụp theo lịch, khôi phục về thời điểm) có ở cụm trả phí; cụm miễn phí M0 không có sao lưu tự động **(theo tài liệu của Atlas – chưa kiểm trên tài khoản của dự án)**. Cấu hình ở trang Backup của cụm.
- **`mongodump` từ máy có Docker** (IP của máy phải nằm trong Network Access): `docker run --rm -e MONGODB_URI -v <thư-mục-sao-lưu>:/backup mongo:8.0 sh -c 'mongodump --uri "$MONGODB_URI" --db chillcat --gzip --archive=/backup/chillcat-atlas-<ngày>.archive.gz'`. `-e MONGODB_URI` lấy giá trị từ shell, chuỗi kết nối không nằm trong lệnh.

### 4.3 Chuyển dữ liệu từ container sang Atlas (suy luận, chưa diễn tập)

1. Sao lưu container theo §4.1 (giữ `app` dừng).
2. Nạp lên Atlas: `docker run --rm -e MONGODB_URI -v <thư-mục-sao-lưu>:/backup mongo:8.0 sh -c 'mongorestore --uri "$MONGODB_URI" --gzip --archive=/backup/chillcat-<ngày>.archive.gz --nsInclude "chillcat.*"'` (shell đặt `MONGODB_URI` là chuỗi `mongodb+srv://…` của Atlas).
3. Đổi cấu hình và khởi động theo [DEP-00 §6.1.5](DEP-00_Trien_khai_tong_the.md).

## 5. Đổi bí mật định kỳ

1. **Biết mình đang có những gì:** danh sách tên biến ở [DEP-00 §5](DEP-00_Trien_khai_tong_the.md). Bí mật thật sự: `JWT_SECRET`, `AI_API_KEY`, mật khẩu nằm trong `MONGODB_URI` (khi dùng Atlas), `BOOTSTRAP_ADMIN_PASSWORD`. Chúng nằm trong `backend/deploy/.env` (máy phát triển: `backend/.env`) – bị `backend/.gitignore` loại khỏi git và bị `backend/Dockerfile.dockerignore` (`**/.env`) loại khỏi ngữ cảnh build, nên không vào ảnh. Không có kho bí mật riêng.
2. **Đổi:** chưa có lịch định kỳ và chưa chỉ định người làm (§9). Cách đổi từng loại:

| Bí mật | Đổi thế nào | Ảnh hưởng |
|---|---|---|
| `JWT_SECRET` | Sinh chuỗi mới ít nhất 32 ký tự (lệnh PowerShell và `openssl rand -hex 32` ghi trong `backend/deploy/.env.example`) → sửa `.env` → `docker compose up -d` | Mọi access token đang lưu hành mất hiệu lực ngay. Theo mã, phiên (refresh token, lưu băm trong collection `sessions`) không được ký bằng `JWT_SECRET`, nên giao diện tự làm mới và người dùng **không** phải đăng nhập lại **(suy luận** từ `backend/crates/identity/src/service.rs#refresh`, `js/api.js#API.call`**)** – khác với chú thích "mọi phiên đăng nhập mất hiệu lực" ở `backend/deploy/.env.example` và `config.rs`. Muốn mọi phiên mất hiệu lực: thu hồi phiên như OP-15 bước 2 |
| `AI_API_KEY` | Tạo khoá mới ở Anthropic Console → sửa `.env` → `docker compose up -d` → thu hồi khoá cũ | Lần chạy AI đang dở có thể thất bại (OP-08) |
| Mật khẩu người dùng CSDL Atlas | Atlas Database Access: tạo người dùng mới cùng quyền, đổi `MONGODB_URI`, `docker compose up -d --no-deps app`, rồi xoá người dùng cũ | Làm theo thứ tự này thì máy chủ không mất kết nối giữa chừng **(suy luận)** |
| `BOOTSTRAP_ADMIN_PASSWORD` | Chỉ dùng một lần (§1.1). Sau đó đổi mật khẩu trong ứng dụng (`POST /api/v1/me/password`) và xoá biến khỏi `.env` | Đổi biến khi đã có quản trị viên không có tác dụng |
| Container `mongo` đi kèm | Không có mật khẩu: MongoDB chạy không bật xác thực, chỉ nghe trong mạng compose (cổng 27017 không mở ra máy) | Đánh giá rủi ro ở [ASM-00](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) |

## 6. Theo dõi sức khoẻ

| Theo dõi | Hiện có | Báo động khi | Nên thêm |
|---|---|---|---|
| Dịch vụ còn trả lời | `GET /healthz` → `ok`; `HEALTHCHECK` của ảnh mỗi 30 s (hết giờ 5 s, chờ đầu 20 s), thấy ở `docker compose ps` | `unhealthy`, hoặc `Restarting` liên tục (lỗi khởi động – OP-01 đến OP-06) | Chưa có cảnh báo tự động – [ASM-00 §9](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) |
| CSDL sẵn sàng | `GET /readyz` (ping MongoDB): `200 ready` / `503 mongo unavailable`; healthcheck `mongo` mỗi 10 s (có primary ghi được) | `503`, `mongo` `unhealthy` (OP-07) | Như trên |
| Log | JSON một dòng mỗi bản ghi (`LOG_FORMAT=json`, mặc định trong ảnh): `timestamp`, `level`, `fields.message`, `target`; mức theo `RUST_LOG` (mặc định `info,tower_http=info,mongodb=warn`); xem bằng `docker compose logs` | Dòng `"level":"ERROR"`: "Không khởi động được máy chủ", "Lỗi khi xử lý yêu cầu" (lỗi nội bộ / CSDL), "Tác vụ định kỳ lỗi", "Sự kiện hỏng sau nhiều lần thử…", "Chạy AI cho ticket thất bại". WARN "Refresh token cũ bị dùng lại – đã thu hồi phiên" là dấu hiệu token bị đánh cắp | Gom log tập trung – ASM-00 §9 |
| Từng yêu cầu HTTP | `TraceLayer` của `tower-http` ghi vết mọi yêu cầu, nhưng ở mức DEBUG; với `tower_http=info` chỉ thấy yêu cầu lỗi **(suy luận** theo mặc định của `tower-http`**)**. Muốn xem mọi yêu cầu: đặt `RUST_LOG=info,tower_http=debug,mongodb=warn` rồi `docker compose up -d` | – | – |
| Tác vụ định kỳ, outbox | Log và truy vấn ở §2 | Sự kiện hỏng > 0; lần chạy AI treo > 20 phút | Chỉ số cho hàng đợi outbox – ASM-00 §9 |
| Tài nguyên máy | `docker stats --no-stream` (lúc rỗi: `app` ~3 MB, `mongo` ~116 MB); `docker system df` | Ổ đĩa gần đầy (OP-10) | Giới hạn bộ nhớ / CPU cho container – ASM-00 §9 |
| Bản đang chạy | `GET /api/v1/meta` | `version` khác bản vừa phát hành | – |
| Atlas | Trang theo dõi của Atlas (chưa cấu hình cảnh báo) | – | Cảnh báo của Atlas – ASM-00 §9 |

## 7. Giới hạn hiện tại

- Một bản `app` và MongoDB một node khi chạy compose: không có dự phòng; hỏng máy là dừng dịch vụ, và mất dữ liệu nếu không có bản sao lưu (SYS-N06).
- Tối đa 20 kết nối MongoDB (`MONGODB_MAX_POOL`); thân yêu cầu 16 MB (`REQUEST_BODY_LIMIT_MB`); lời gọi AI hết giờ sau 300 giây; tác vụ xoá phiên bản xử lý tối đa 500 bản mỗi lượt.
- Container không có giới hạn bộ nhớ / CPU; log container không xoay vòng **(suy luận)**.
- Máy chủ không tự phục vụ HTTPS; MongoDB đi kèm không bật xác thực.
- Chưa có chỉ tiêu và số đo hiệu năng (SYS-N07).
- Không có e-mail, không có tự đặt lại mật khẩu (OP-12).
- Nâng cấp làm dịch vụ gián đoạn khoảng thời gian thay container (~16 giây cộng thời gian dừng container cũ) **(suy luận)**.
- Build ảnh trên máy 8 GB RAM cần `CARGO_BUILD_JOBS=2`; build lại sau khi đổi mã Rust mất ~11 phút.

## 8. Ai trực, gọi ai

| Vai trò | Người | Liên lạc qua |
|---|---|---|
| Trực vận hành (SH-OPS) | Nhóm phát triển ChillCat Studio – chưa chỉ định cá nhân | Chưa quy định |
| Phụ trách hệ thống con HUB | Nhóm phát triển ChillCat Studio | Chưa quy định; khi HUB đã triển khai, có thể dùng ticket của chính HUB (BP-31) |
| Phụ trách EDT, GitHub Pages, tên miền `design.trungctr.com` | Chủ kho GitHub và tài khoản DNS (Cloudflare) | Chưa quy định |
| Quản trị hệ thống (SH-ADM) | Quản trị viên đầu tiên (§1.1) và người được cấp thêm | Trong ứng dụng |
| Nhà cung cấp ngoài | MongoDB Atlas, Anthropic, GitHub | Kênh hỗ trợ của từng nhà cung cấp |

## 9. Vấn đề còn mở

- **StR-29 – sao lưu:** hệ thống chưa có chức năng sao lưu tích hợp; chưa có lịch, nơi cất, người chịu trách nhiệm; chưa từng khôi phục thử; các lệnh ở §4 chưa diễn tập. Chưa chốt giao cho vận hành nội bộ hay Cloud Backup của Atlas.
- **OP-12 – quên mật khẩu:** chưa có tự đặt lại mật khẩu, quản trị viên cũng không đặt lại được; cách tạm làm người dùng mất lịch sử của tài khoản cũ. OP-13 cũng phụ thuộc vào điểm này.
- **Đổi `JWT_SECRET`:** phân tích mã cho thấy phiên vẫn còn sau khi đổi khoá (§5), trái với chú thích ở `backend/deploy/.env.example` và cảnh báo trong `config.rs`. Chưa kiểm thử thật; chú thích nào đúng cần được xác nhận.
- **Khoá tài khoản:** access token đã cấp còn hiệu lực tới 15 phút sau khi khoá **(suy luận)** – chưa kiểm thử.
- **Thao tác thẳng vào CSDL** (OP-09 phát lại sự kiện, OP-13 nâng quản trị, OP-14 mở khoá đăng nhập, OP-15 thu hồi phiên, OP-19 `collMod`) không đi qua nhật ký và chưa diễn tập.
- Không có cảnh báo tự động, không gom log, log container không xoay vòng.
- Chưa chỉ định người trực, chưa có lịch đổi bí mật, chưa có kho bí mật.
- Chưa có quy trình nâng bản lớn MongoDB.
- Mức log của từng yêu cầu HTTP với `RUST_LOG` mặc định (§6) là suy luận – cần kiểm.
- Thời hạn thông báo (180 ngày) và sự kiện outbox đã phát (7 ngày) là hằng số trong mã; sự kiện hỏng giữ mãi.
- Thông tin về Cloud Backup theo gói Atlas (§4.2) chưa kiểm trên tài khoản của dự án.
- Liên kết tới [SAD-00 §6](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) viết khi SAD-00 đang được lập song song – kiểm lại số mục khi SAD-00 xong.

## 10. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | 2026-11-18 | Khởi tạo từ bộ mẫu, viết lại từ hệ thống đang chạy | Nhóm phát triển ChillCat Studio |
