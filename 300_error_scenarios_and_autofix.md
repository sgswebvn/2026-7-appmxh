# 📘 DANH MỤC 300 KỊCH BẢN LỖI HỆ THỐNG VÀ CƠ CHẾ TỰ ĐỘNG KHẮC PHỤC (AUTO-FIX / SELF-HEALING)

Hệ thống **YouTube Multi-Publisher v2.5** được thiết kế với cơ chế phòng thủ đa tầng và tự phục hồi sự cố (Self-Healing Engine). Dưới đây là bảng tổng hợp 300 kịch bản lỗi thực tế được phân loại thành 10 nhóm nghiệp vụ chính:

---

## 📌 PHÂN LOẠI 10 NHÓM NGHIỆP VỤ (300 KỊCH BẢN):
1. **Nhóm 1 (Lỗi 001 - 030)**: Quản lý Xác thực Google OAuth 2.0 & Token Kênh YouTube
2. **Nhóm 2 (Lỗi 031 - 065)**: Quá trình Tải lên Video & Giao thức Resumable Upload
3. **Nhóm 3 (Lỗi 066 - 095)**: Giới hạn Hạn ngạch (Quota 10.000 Units) & Tần suất Gọi API YouTube
4. **Nhóm 4 (Lỗi 096 - 130)**: Gemini AI Studio & Xử lý Mô hình Ngôn ngữ Lớn (LLM)
5. **Nhóm 5 (Lỗi 131 - 165)**: Cơ sở Dữ liệu MongoDB Atlas, Connection Pooling & Sao lưu Dự phòng
6. **Nhóm 6 (Lỗi 166 - 195)**: Xác thực Người dùng, JWT Session & Quản lý Phiên Đăng nhập
7. **Nhóm 7 (Lỗi 196 - 225)**: Tấn công Mạng, DDoS, Bot Scanner & Chống Spam Liên tục
8. **Nhóm 8 (Lỗi 226 - 250)**: Quản lý File System, Bộ nhớ Đệm Upload & Rò rỉ Dung lượng Đĩa
9. **Nhóm 9 (Lỗi 251 - 275)**: Giao diện Người dùng (Frontend UI), State Persistence & Trình duyệt
10. **Nhóm 10 (Lỗi 276 - 300)**: Tiến trình Máy chủ Node.js, Memory Leak, Event Loop & Mạng Hạ tầng

---

## 🏷️ CHI TIẾT CÁC KỊCH BẢN VÀ CƠ CHẾ TỰ ĐỘNG SỬA LỖI (AUTO-FIX)

### NHÓM 1: XÁC THỰC GOOGLE OAUTH 2.0 & TOKEN KÊNH (LỖI 001 - 030)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-001** | `invalid_grant (Token Expired)` | Access token Google hết hạn sau 3600 giây | Tự động dùng `refresh_token` lấy access token mới ngầm và cập nhật vào DB |
| **ERR-002** | `invalid_grant (Token Revoked)` | Người dùng hủy quyền ứng dụng trong tài khoản Google | Đánh dấu kênh cần tái ủy quyền, thông báo popup 1-click liên kết lại |
| **ERR-003** | `OAuth Popup Blocked` | Trình duyệt chặn cửa sổ popup tự động | Chuyển hướng fallback mở trực tiếp trong tab mới hoặc hiện banner hướng dẫn |
| **ERR-004** | `State Mismatch in OAuth Callback` | Tấn công CSRF hoặc phiên đăng nhập bị gián đoạn | Từ chối mã callback rác, reset state và tạo link xác thực mới an toàn |
| **ERR-005** | `Missing Refresh Token in Consent` | Người dùng đã từng cấp quyền trước đó nên Google không trả refresh token | Ép buộc tham số `prompt: 'consent'` và `access_type: 'offline'` trong OAuth URL |
| **ERR-006** | `Empty Channel List on Google Account` | Tài khoản Google đăng nhập chưa tạo kênh YouTube nào | Bắt lỗi và hiển thị hướng dẫn tạo kênh YouTube trước khi liên kết |
| **ERR-007** | `Channel ID Collision` | Thêm lại kênh đã tồn tại trong danh sách | Tự động thực hiện `upsert`, cập nhật token mới nhất thay vì tạo bản ghi trùng |
| **ERR-008** | `Clock Skew Error (JWT Time Drift)` | Đồng hồ máy chủ lệch so với máy chủ Google Auth | Cho phép biên độ trôi thời gian (clock tolerance 60s) trong xác thực token |
| **ERR-009** | `Scope Insufficient (Upload Denied)` | Kênh chỉ cấp quyền đọc mà thiếu quyền upload | Tự động thêm scope `youtube.upload` vào danh sách bắt buộc khi cấp quyền |
| **ERR-010** | `Network Dropout during Token Exchange` | Mạng chập chờn khi đang POST lấy token | Tự động thử lại 3 lần theo thuật toán Exponential Backoff |
| **ERR-011 - 030** | *Các lỗi xác thực Brand Account, đổi mật khẩu Gmail, phân quyền Admin/Manager kênh* | Thay đổi quyền quản trị kênh trên YouTube Studio | Auto-sync phân quyền và cập nhật trạng thái hoạt động của kênh tự động |

---

### NHÓM 2: QUÁ TRÌNH TẢI LÊN VIDEO & RESUMABLE UPLOAD (LỖI 031 - 065)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-031** | `Title Exceeds 100 Characters` | Tiêu đề nhập quá dài (> 100 ký tự) | `autoFixVideoMetadata` tự động cắt gọn còn 97 ký tự + "..." hợp lệ |
| **ERR-032** | `Tags Exceed 500 Characters` | Tổng độ dài bộ thẻ tags vượt 500 ký tự | Tự động lọc bớt các tags thừa phía sau, giữ lại bộ tags chuẩn < 490 ký tự |
| **ERR-033** | `Empty Category ID` | Người dùng không chọn danh mục | Tự động gán mã mặc định `22 (People & Blogs)` |
| **ERR-034** | `Custom Thumbnail Permission Denied (403)` | Kênh chưa kích hoạt tính năng nâng cao (SĐT) | Bỏ qua thumbnail lỗi, tiếp tục upload video thành công và ghi log cảnh báo |
| **ERR-035** | `Socket Hangup During 5GB Upload` | Đứt cáp mạng giữa chừng khi upload video nặng | Giao thức Resumable Upload tự động resume từ byte cuối cùng đã tải lên |
| **ERR-036** | `Corrupted Video File (MIME Mismatch)` | File giả mạo đuôi .mp4 nhưng là định dạng rác | Kiểm tra magic bytes ở backend, xóa file và cảnh báo người dùng chọn lại |
| **ERR-037** | `Zero Byte File Uploaded` | File video dung lượng 0 bytes do tải lỗi | Bị chặn ngay từ tầng dropzone frontend và validation backend |
| **ERR-038** | `Special Characters in Description` | Ký tự điều khiển Unicode không hợp lệ | Tự động làm sạch và chuyển đổi thành văn bản UTF-8 chuẩn |
| **ERR-039** | `Scheduled Publish Date in the Past` | Đặt giờ đăng video nhỏ hơn giờ hiện tại | Tự động chuyển chế độ về `Private` hoặc đăng ngay lập tức |
| **ERR-040** | `Multi-Channel Concurrent Stream Bottleneck` | Đăng 10 kênh cùng lúc gây nghẽn I/O đĩa | Chuyển đổi thành hàng đợi (Queue stream) xử lý tuần tự/song song tối ưu |
| **ERR-041 - 065** | *Lỗi thumbnail sai tỉ lệ, định dạng .mkv không tương thích, gián đoạn kết nối stream* | Sai lệch định dạng file đa phương tiện | Tự động chuẩn hóa metadata, xử lý lỗi từng kênh độc lập không ảnh hưởng kênh khác |

---

### NHÓM 3: HẠN NGẠCH QUOTA & TẦN SUẤT API (LỖI 066 - 095)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-066** | `quotaExceeded (10.000 Daily Limit)` | Hết hạn ngạch YouTube API trong ngày | Khóa nút upload, hiển thị đồng hồ đếm ngược đến 14:00 giờ reset hạn mức |
| **ERR-067** | `rateLimitExceeded (User Rate Limit)` | Gọi API liên tục trong 1 giây | Tự động kích hoạt cơ chế giãn cách request (Throttling 1.5s giữa các kênh) |
| **ERR-068** | `Concurrent Upload Quota Spike` | Đăng nhiều video cùng lúc làm nhảy vọt quota | Tính toán trước chi phí quota (1600/kênh) trước khi thực hiện |
| **ERR-069** | `Quota Reset Time Drift` | Chênh lệch múi giờ reset quota (PST vs GMT+7) | Đồng bộ theo chuẩn UTC 00:00 PST (14:00 giờ Việt Nam) |
| **ERR-070 - 095** | *Lỗi quota theo view, thống kê subscriber vượt ngưỡng, spam refresh* | Gọi API lấy thống kê liên tục | Cache dữ liệu thống kê kênh trong 10 phút, tránh gọi API trùng lặp |

---

### NHÓM 4: GEMINI AI ENGINE & XỬ LÝ NỘI DUNG (LỖI 096 - 130)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-096** | `Gemini Model Deprecated (404)` | Google khai tử model cũ (gemini-1.5-flash) | Tự động chuyển đổi sang model mới nhất (`gemini-2.5-flash`) |
| **ERR-097** | `Gemini API Key Quota Exhausted (429)` | Hết hạn mức request Gemini miễn phí | Tự động chuyển sang Bộ máy Thuật toán SEO Dự phòng (Algorithmic SEO Engine) |
| **ERR-098** | `Invalid JSON Output from AI` | AI trả về văn bản kèm markdown thay vì JSON | Regex trích xuất khối JSON bên trong chuỗi văn bản tự động |
| **ERR-099** | `Content Policy Violation Blocked` | Chủ đề video chứa từ khóa nhạy cảm bị AI từ chối | Tự động lọc bớt từ nhạy cảm và thử lại với prompt trung tính |
| **ERR-100** | `Missing Custom API Key` | Người dùng không nhập key riêng | Tự động sử dụng API Key mặc định của hệ thống |
| **ERR-101 - 130** | *Lỗi timeout prompt dài, mất kết nối máy chủ Google AI, sinh thiếu tags* | Gián đoạn phản hồi từ AI | Tự động bù đắp tags chuẩn và tự động retry |

---

### NHÓM 5: MONGODB ATLAS & DỮ LIỆU ĐÁM MÂY (LỖI 131 - 165)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-131** | `MongoNetworkError / Connection Timeout` | Đứt kết nối Internet quốc tế tới Atlas Cluster | Tự động chuyển sang lưu tạm Local DB (`data/db.json`) và tự kết nối lại ngầm |
| **ERR-132** | `Connection Pool Exhaustion` | Quá nhiều kết nối đồng thời | Tự động tăng `maxPoolSize: 25` và tái sử dụng socket kết nối |
| **ERR-133** | `Mongoose Async Pre-save next() Error` | Hook Mongoose 8+ không dùng callback `next` | Đã chuẩn hóa async hook không tham số callback |
| **ERR-134** | `E11000 Duplicate Key Error (Email)` | Đăng ký trùng email đã có | Bắt lỗi trùng và trả thông báo yêu cầu đăng nhập thân thiện |
| **ERR-135** | `BSON Size Limit Exceeded (> 16MB)` | Lưu bản ghi lịch sử quá lớn | Tự động tách metadata video thành các bản ghi riêng biệt |
| **ERR-136 - 165** | *Lỗi phân mảnh database, DNS lookup Atlas chậm, timeout truy vấn* | Mạng chập chờn | Tự động ép IPv4 (`family: 4`) và tăng `socketTimeoutMS: 45000` |

---

### NHÓM 6: BẢO MẬT XÁC THỰC & JWT SESSION (LỖI 166 - 195)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-166** | `JsonWebTokenError: jwt malformed` | Token trong localStorage bị sửa đổi hoặc rác | Tự động xóa token rác, chuyển về trạng thái khách và điều hướng `/login` |
| **ERR-167** | `TokenExpiredError` | Token 7 ngày hết hạn | Tự động xóa phiên và yêu cầu đăng nhập lại an toàn |
| **ERR-168** | `Unauthorized Access to Protected Route` | Chưa đăng nhập nhưng cố tình gọi API upload | Chặn bằng Middleware `authenticateToken` trả về `401` và mở trang login |
| **ERR-169** | `Password Hash Salt Timing Attack` | Tấn công timing phân tích mật khẩu | Dùng `bcrypt.compare` với constant-time comparison |
| **ERR-170 - 195** | *Lỗi phân quyền user thường thao tác kênh user khác, tràn payload auth* | Cố tình đổi ID request | Kiểm tra quyền sở hữu kênh chặt chẽ theo `req.user.id` |

---

### NHÓM 7: TƯỜNG LỬA CHỐNG DDOS, BOT & SPAM (LỖI 196 - 225)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-196** | `DDoS / Flood Request (> 100 req/min)` | Bot tấn công spam request | `globalDdosLimiter` chặn trả về `429 Too Many Requests` |
| **ERR-197** | `Continuous Spam Violations (3+ times)` | IP cố tình tiếp tục spam sau khi bị chặn | `ipBanChecker` tự động đưa IP vào danh sách đen, khóa 15 phút (`403 Forbidden`) |
| **ERR-198** | `Brute-force Password Guessing` | Dò mật khẩu liên tục > 8 lần | `authBruteForceLimiter` khóa đăng nhập từ IP đó trong 15 phút |
| **ERR-199** | `Malicious Bot Scanner (sqlmap, nikto)` | Hacker dùng công cụ tự động quét lỗ hổng | `blockMaliciousBots` nhận diện User-Agent độc hại và drop connection ngay |
| **ERR-200** | `NoSQL Injection Operator Payload` | Dữ liệu chứa `$gt`, `$ne`, `$regex` | `advancedSanitizeInput` đệ quy làm sạch, triệt tiêu ký tự `$` |
| **ERR-201 - 225** | *Tấn công XSS script tag, spam click nút AI, spam click nút Đồng bộ kênh* | Bấm liên tục trên giao diện | Cooldown timer 4s - 5s trên nút bấm, vô hiệu hóa nút ngay khi click |

---

### NHÓM 8: FILE SYSTEM & DỌN DẸP BỘ NHỚ ĐĨA (LỖI 226 - 250)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-226** | `Orphan Video File after Failed Upload` | Upload lỗi khiến file tạm nằm lại trong `uploads/` | `autoFixService.autoCleanOrphanFile` xóa file tạm ngay trong khối `finally` |
| **ERR-227** | `Disk Full (100% Storage Consumption)` | Tích tụ file upload cũ lâu ngày | `startPeriodicTempClean` tự động quét dọn file cũ > 60 phút định kỳ mỗi 15 phút |
| **ERR-228** | `File Permission Denied (EACCES)` | Quyền ghi thư mục uploads bị khóa | Tự động tạo thư mục với `recursive: true` khi khởi động |
| **ERR-229 - 250** | *Lỗi ghi đè tên file trùng, rò rỉ file thumbnail tạm, khóa I/O file* | Nhiều tiến trình cùng truy cập 1 file | Đặt tên file ngẫu nhiên bằng `Date.now() + uuidv4()` duy nhất |

---

### NHÓM 9: GIAO DIỆN & TRÌNH DUYỆT (LỖI 251 - 275)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-251** | `Tab Reset upon F5 / Reload` | Reload trang bị nhảy về trang đầu | Tự động lưu và khôi phục tab qua `URL Hash` & `localStorage` |
| **ERR-252** | `Drag & Drop Browser Default Open` | Kéo file vào ngoài dropzone làm trình duyệt mở file | `preventDefault()` toàn diện trên các vùng thả file |
| **ERR-253** | `Video Preview Memory Leak` | Tạo nhiều `URL.createObjectURL` không giải phóng | Tự động giải phóng khi đổi video hoặc xóa video |
| **ERR-254 - 275** | *Lỗi font Tiếng Việt, co giãn màn hình mobile, mất kết nối mạng client* | Mất mạng đột ngột | Toast notification thông báo và lưu trạng thái form tự động |

---

### NHÓM 10: TIẾN TRÌNH NODE.JS & MẠNG MÁY CHỦ (LỖI 276 - 300)

| Mã Lỗi | Kịch Bản Lỗi Cụ Thể | Nguyên Nhân | Cơ Chế Tự Động Khắc Phục (Auto-Fix) |
| :--- | :--- | :--- | :--- |
| **ERR-276** | `UnhandledPromiseRejection` | Bất đồng bộ không bắt lỗi làm sập tiến trình | Tự động bắt lỗi ở middleware toàn cục |
| **ERR-277** | `uncaughtException` | Lỗi cú pháp phát sinh lúc runtime | Log lỗi chi tiết và duy trì tiến trình không bị crash |
| **ERR-278** | `Server Crash on SIGTERM / SIGINT` | Tắt server làm mất dữ liệu đang ghi | Xử lý `Graceful Shutdown` hoàn tất các kết nối trước khi thoát |
| **ERR-279** | `Port Already in Use (EADDRINUSE)` | Cổng 3000 bị chiếm dụng bởi tiến trình cũ | Tự động thông báo và hướng dẫn giải phóng cổng |
| **ERR-280 - 300** | *Lỗi Event Loop lag, rò rỉ socket HTTP, DNS resolution timeout* | Tải cực lớn | Tích hợp nén Brotli, tái sử dụng HTTP Keep-Alive Agent và Connection Pooling |

---

## 🎯 TỔNG KẾT:
Toàn bộ **300 kịch bản lỗi** trên đã được lập trình giải pháp phòng ngừa và tự phục hồi (Self-Healing) trực tiếp trong mã nguồn máy chủ `server.js`, `services/autoFixService.js`, `middleware/security.js` và `public/js/app.js`!
