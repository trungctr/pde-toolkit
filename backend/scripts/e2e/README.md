# Kiểm thử giao diện đầu-cuối (tab Dự án)

Chạy trên Chrome / Edge thật (headless) với một máy chủ đang chạy, dữ liệu trống hoặc không – mỗi lần chạy tạo tài khoản,
workspace mới bằng mã ngẫu nhiên.

```powershell
cd backend/scripts/e2e
npm install                                   # puppeteer-core (không tải trình duyệt)
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"   # tuỳ máy
node ui.mjs http://localhost:8080/ ./shots                     # một người: 25 kiểm tra
node ui-team.mjs http://localhost:8080/ ./shots ../../deploy   # hai người + khởi động lại container: 40 kiểm tra
```

| Script | Nội dung |
|---|---|
| `ui.mjs` | Đăng ký → tạo workspace → hệ thống con → tạo StRS → soạn ở tab Tài liệu, `Ctrl+S` → gửi duyệt → duyệt → phát hành → truy vết → ticket → các trang quản lý → chế độ tối → phím tắt `Alt+4/5` |
| `ui-team.mjs` | Hai phiên trình duyệt tách biệt: owner mời thành viên vào group → thành viên nhận lời, soạn, gửi duyệt (không có nút Duyệt / Phát hành) → owner nhận thông báo, duyệt, phát hành, nhận xét → thành viên trả lời, gửi ticket → owner **tự cấp quyền ticket** (không có quyền mặc định) rồi xử lý → đăng xuất / sai mật khẩu / đăng nhập lại → (tham số thứ 3) `docker compose restart app`: phiên và dữ liệu còn nguyên |

Lỗi console / HTTP 5xx / 401 ngoài ý muốn của chính máy chủ làm bài thất bại; lỗi của tài nguyên bên ngoài (ví dụ
`responsivevoice.org`) được bỏ qua. Ảnh chụp từng bước lưu vào thư mục tham số thứ 2.
