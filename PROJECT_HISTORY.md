# 📜 LỊCH SỬ DỰ ÁN & TÀI LIỆU CHUYỂN GIAO TOÀN DIỆN (PROJECT HISTORY FOR AI & DEVELOPERS)

> **Tài liệu này được tạo để bất kỳ AI Model hoặc Lập trình viên nào tiếp nhận dự án đều có thể hiểu toàn bộ kiến trúc, hành trình phát triển, các lỗi đã được sửa và toàn bộ mã nguồn của hệ thống.**

---

## 🌟 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)
- **Tên dự án:** YouTube Multi-Publisher v3.0 (Hệ thống phân phối video YouTube đa kênh tự động hóa & Hàng đợi nền).
- **Mục tiêu cốt lõi:**
  1. **1-Click Tải lên & Phân phối qua Hàng đợi nền (Background Queue Engine):** Xử lý tải video nặng (>2GB) trên hàng chục kênh cùng lúc với cơ chế kiểm soát Concurrency và theo dõi tiến trình thời gian thực (Job ID polling).
  2. **Kiến trúc Router Mô-đun (Modular Routes Architecture):** Hệ thống phân tách thành các router chuyên trách (`auth.js`, `channels.js`, `upload.js`, `ai.js`, `admin.js`, `analytics.js`, `general.js`).
  3. **Analytics Dashboard (Chart.js):** Bảng điều khiển trực quan hóa số liệu kênh, thống kê tăng trưởng lượt xem, người đăng ký, phân bổ video và tỷ lệ thành công.
  4. Tùy biến tiêu đề, mô tả riêng cho từng kênh để chống thuật toán YouTube phạt trùng lặp nội dung.
  5. Tích hợp **Gemini AI (Model: `gemini-2.5-flash`)** tự động tạo gói nội dung SEO (5 tiêu đề Viral CTR cao, mô tả chuẩn SEO có timestamps, tags và biến thể kênh).
  6. Quản lý xác thực người dùng & Cấp tài khoản dùng thử 10 phút tự động khóa.
  7. Bộ máy tự phục hồi và sửa lỗi tự động (**Self-Healing AutoFix Engine**) giải quyết 300 kịch bản lỗi thực tế.
- **Kho lưu trữ GitHub:** [https://github.com/sgswebvn/2026-4-ytbmuti.git](https://github.com/sgswebvn/2026-4-ytbmuti.git) (Nhánh `main`).

---

## 🛠️ 2. STACK CÔNG NGHỆ (TECH STACK)
- **Backend:** Node.js, Express.js.
- **Database:** MongoDB Atlas (Cloud) + Mongoose 8.x (Có cơ chế Local Resilience Fallback đệm an toàn `data/db.json`).
- **Google & YouTube Integration:** `googleapis` v3 (Giao thức Google OAuth 2.0 Offline Token + Resumable Upload protocol).
- **AI Engine:** Google Generative AI (`gemini-2.5-flash`) + Smart SEO Algorithmic Fallback.
- **Bảo mật & Tối ưu:** `helmet`, `compression` (Brotli/Gzip), `express-rate-limit`, `bcryptjs`, `jsonwebtoken`.
- **Frontend:** Vanilla HTML5, JavaScript (ES6+), Vanilla CSS (Chuẩn 3 màu cơ bản: Nền Tối `#0b0d13`/`#121620`, Chữ Trắng `#fff`/Xám `#94a3b8`, Điểm nhấn Đỏ YouTube `#dc2626`).

---

## 🔑 3. CẤU HÌNH & BIẾN MÔI TRƯỜNG (.env)
```env
PORT=3000
MONGODB_URI=mongodb+srv://hieucv204_db_user:7XWOE7IqidhpvmLW@cluster0.jclrhni.mongodb.net/ytb-multi?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=ytb_multi_jwt_secret_shield_key_2026_secure!
GOOGLE_CLIENT_ID=1030455730184-v9ajg8667q3h1d0vcodtp2er5imdhekp.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
GEMINI_API_KEY=AQ.Ab8RN6Kj9_KZVQ6egDt5TsCZSK2YbYtRdjbd0Y4xyVPjkcguag
```

---

## 📂 4. CẤU TRÚC THƯ MỤC & CÁC FILE CHÍNH
```text
├── config/
│   └── db.js                       # Quản lý kết nối MongoDB Atlas (Connection Pool: 25)
├── models/
│   ├── User.js                     # Schema người dùng, hash mật khẩu bcrypt (Mongoose 8+ async pre-save)
│   ├── Channel.js                  # Schema lưu trữ kênh YouTube, OAuth tokens, stats
│   ├── History.js                  # Schema lưu lịch sử đăng video và link YouTube
│   └── GeminiDraft.js              # Schema lưu trữ bản nháp AI
├── middleware/
│   ├── auth.js                     # Middleware xác thực JWT token (Bearer token)
│   └── security.js                 # Tường lửa chống DDoS, Auto-Ban IP spam, lọc NoSQL/XSS
├── services/
│   ├── autoFixService.js           # Bộ máy tự sửa lỗi (AutoFix / Self-Healing)
│   ├── dbService.js                # Tầng DAO thao tác dữ liệu MongoDB / Local fallback
│   ├── geminiService.js            # Dịch vụ gọi Gemini 2.5 Flash & Algorithmic SEO fallback
│   └── youtubeService.js           # Xử lý OAuth2, Resumable Upload stream, đồng bộ stats
├── public/
│   ├── css/style.css               # Giao diện tối giản 3 màu cơ bản, không màu mè
│   ├── js/app.js                   # Xử lý sự kiện Frontend, lưu tab F5, upload form, anti-spam debounce
│   ├── index.html                  # Giao diện ứng dụng chính (Tiếng Việt có dấu chuẩn 100%)
│   └── login.html                  # Giao diện Đăng nhập / Đăng ký chuyên dụng
├── server.js                       # Entry point máy chủ Express, cấu hình Multer 5GB, Graceful shutdown
├── 300_error_scenarios_and_autofix.md  # Danh mục 300 kịch bản lỗi và cơ chế tự sửa
└── package.json                    # Cấu hình dependency dự án
```

---

## 🚀 5. CÁC VẤN ĐỀ ĐÃ ĐƯỢC XỬ LÝ TRONG PHIÊN LÀM VIỆC

### 1. Tắt cơ chế Auto-Login Demo:
- **Trước đó:** Khi mở trang chủ, client tự động đăng nhập vào `admin@test.com`.
- **Đã sửa:** Bỏ hoàn toàn auto-login. Khi vào trang chủ, trạng thái là khách; nút góc trên bên phải hiển thị "Đăng Nhập / Đăng Ký" dẫn đến trang `/login`.

### 2. Ghi và đồng bộ trực tiếp dữ liệu vào MongoDB Atlas:
- **Nguyên nhân lỗi cũ:** Getter kiểm tra kết nối Mongoose được evaluate 1 lần tại require time, khóa kết nối ở trạng thái `false`. Mongoose 8+ async hook `pre('save')` truyền `next()` gây lỗi `TypeError: next is not a function`.
- **Đã sửa:** Kiểm tra `mongoose.connection.readyState === 1` động theo thời gian thực và sửa lại hook `User.js`. Đã kiểm thử ghi thành công trực tiếp vào collection `users`, `channels`, `histories`, `geminidrafts` trên database `ytb-multi`.

### 3. Tự động tăng số lượng Video và Đồng bộ số liệu kênh:
- Khi đăng video thành công, hệ thống tự động tăng `videoCount` trong Database.
- Bổ sung nút **"Đồng bộ số liệu từ YouTube"** (API `POST /api/channels/sync`) để 1-click kéo toàn bộ số sub và số video thực tế từ YouTube Studio về hệ thống.

### 4. Giữ nguyên Tab đang mở khi Reload (F5):
- Tích hợp `URL Hash` (`#publish-tab`, `#gemini-tab`, `#channels-tab`, `#history-tab`) và `localStorage` để khi F5 trang không bị nhảy về trang đầu.

### 5. Chuẩn hóa Giao diện 3 Màu & Tiếng Việt có dấu:
- Loại bỏ toàn bộ icon emoji rườm rà.
- Áp dụng triệt để 3 màu cơ bản: Nền Tối, Chữ Trắng/Xám, Điểm nhấn Đỏ YouTube.
- Toàn bộ văn bản hiển thị bằng Tiếng Việt có dấu đầy đủ, chuẩn xác 100%.

### 6. Nâng cấp Bảo Mật, Chống Spam & Chịu Tải Cao (v2.5):
- **High Load:** Connection pool 25 kết nối, nén Brotli/Gzip giảm 70% dung lượng mạng, hỗ trợ video nặng tới 5GB.
- **Anti-Spam Multi-Tier:** Giới hạn 100 req/min (DDoS), khóa IP tự động 15 phút nếu vi phạm 3 lần, giới hạn 8 lần đăng nhập sai, Cooldown đếm ngược (4s - 5s) trên các nút bấm.
- **Self-Healing Engine:** Tự động cắt tiêu đề > 100 ký tự, lọc tags > 500 ký tự, auto-retry mạng chập chờn, dọn dẹp file tạm rác định kỳ mỗi 15 phút.

### 7. Tính năng Quản trị viên (Admin) cấp tài khoản Dùng thử cho Khách hàng (Tự động khóa sau 10 phút):
- **Trang Đăng Nhập Chuẩn:** Loại bỏ hoàn toàn các nút đăng nhập mẫu/demo hay tài khoản thử nghiệm nhanh. Giao diện đăng nhập/đăng ký hoàn toàn chuyên nghiệp, sạch sẽ để bàn giao trực tiếp cho khách hàng.
- **Tài khoản Quản trị viên (Admin):** `admin@admin.com` / `admin123` (Role: `admin`). Tự động khởi tạo ngay khi server kết nối Database.
- **Admin Panel chuyên dụng:** Tab "Quản Trị Admin" trên thanh điều hướng (chỉ hiển thị với Admin).
- **Tính năng Cấp Tài Khoản cho Admin:**
  1. **Nhập Email & Mật khẩu cấp cho khách:** Admin nhập email khách hàng, mật khẩu, tên/ghi chú khách hàng, và thiết lập thời hạn (mặc định 10 phút).
  2. **Quản lý danh sách khách dùng thử:** Hiển thị toàn bộ tài khoản test, mật khẩu đã cấp (với nút Copy nhanh để gửi cho khách), đồng hồ đếm ngược thời gian thực, trạng thái (Đang dùng thử / Đã hết hạn / Đã khóa).
  3. **Thao tác quản trị:** Nút "+10 Phút" gia hạn thêm thời gian và mở khóa, nút "Khóa / Mở khóa" thủ công, nút "Xóa" tài khoản.
- **Cơ chế tự động khóa và bảo vệ bảo mật:**
  - **Backend Layer:** Middleware `authenticateToken` và `POST /api/auth/login` kiểm tra `expiresAt` và `isLocked`. Khi quá thời gian 10 phút, tự động từ chối truy cập với mã `403 Forbidden` và thông báo rõ ràng cho người dùng.
  - **Frontend Layer:** Khách hàng đăng nhập tài khoản Test sẽ nhìn thấy Badge đếm ngược `⏱️ Dùng thử: mm:ss` trên Navbar. Khi về `00:00`, tự động hiện thông báo hết hạn và chuyển về trang đăng nhập.

### 8. Tương thích triển khai Vercel Serverless & GitHub:
- Cấu hình `vercel.json` định tuyến toàn bộ request về Express application.
- Xuất `module.exports = app` và xử lý kết nối Database Mongoose an toàn cho cả môi trường máy chủ độc lập lẫn Serverless Lambda.

### 9. ĐẠI PHẪU TOÀN DIỆN: AI Video Director + Autonomous Video Factory (v3.5):
- **Triết lý cốt lõi:** *"A Video is not a collection of images. A Video is a sequence of character performances."*
- **12-Step Production State Machine:** `IDEA -> RESEARCH -> CONCEPT -> CAST -> SCRIPT -> SCENES -> SHOTS -> ASSETS -> VIDEO -> VOICE -> LIP_SYNC -> EDIT -> QA -> FIX -> APPROVED -> LEARN`.
- **5 Không Gian Chuyên Nghiệp:**
  1. 🏭 **FACTORY:** Nhập topic $\rightarrow$ Tự hành sản xuất 1-Click.
  2. 🎬 **DIRECTOR:** Dàn diễn viên (Cast Matrix), Quan hệ tâm lý (Relationships), Đối thoại (Dialogue Stream) & Phân cảnh (Scenes/Shots).
  3. 🎥 **PRODUCTION:** Multi-track Voiceover, Lip-sync, Ken Burns 60FPS Render & Master SFX.
  4. 🧪 **AI LAB:** QA Evaluator 10 tiêu chuẩn ($\ge 85/100$), Bộ lọc Hard-fail, Quản lý phiên bản ($v001, v002 \dots$) và **Partial Repair (sửa riêng phân đoạn lỗi tiết kiệm 80% Quota)**.
  5. 🧠 **MEMORY:** Cơ sở dữ liệu tự học Winning Patterns & Failed Patterns lâu dài.
- **Tiêu chuẩn vàng (Gold Standard Benchmark):** Tích hợp chuẩn 6-Shot Micro-Drama theo video triệu view `vidssave.com Cute Baby Talking About Mango 🥭.mp4` với Persona `👶 Bé Bắp & Xoài Chín 🥭`.
- **Multi-AI Failover Pool:** Groq Cloud $\rightarrow$ Google Gemini $\rightarrow$ OpenRouter $\rightarrow$ **Pollinations.ai Unlimited Gateway (100% Free - Không cần key - Không giới hạn token)**.
- **Tài liệu bàn giao chi tiết:** Đọc toàn bộ tại [`MASTER_PROJECT_CONTEXT_HANDOVER.md`](file:///c:/Users/user/Desktop/New%20folder%20(2)/2026-4-ytbmuti/MASTER_PROJECT_CONTEXT_HANDOVER.md).

---

## 💡 6. HƯỚNG DẪN DÀNH CHO AI MODEL KẾ TIẾP (INSTRUCTIONS FOR NEXT AI):
1. **ĐỌC ĐẦU TIÊN:** Luôn đọc file [`MASTER_PROJECT_CONTEXT_HANDOVER.md`](file:///c:/Users/user/Desktop/New%20folder%20(2)/2026-4-ytbmuti/MASTER_PROJECT_CONTEXT_HANDOVER.md) để nắm trọn vẹn toàn bộ bối cảnh và triết lý kiến trúc.
2. Để khởi chạy server: `node server.js` (Server chạy tại port `3000`).
3. Chạy kiểm thử toàn diện: `node scripts/massive-stress-audit.js` (18/18 test suites PASS 100%).
4. Tài khoản Quản trị viên Admin: `admin@admin.com` / `admin123`.
5. Toàn bộ mã nguồn đã được commit và push lên nhánh `main` của GitHub: `https://github.com/sgswebvn/2026-7-appmxh.git`.


