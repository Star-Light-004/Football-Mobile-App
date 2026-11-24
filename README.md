# ⚽ Ứng dụng Di động Quản trị Sân Bóng Đá Hải Châu, Đà Nẵng

Ứng dụng di động đặt sân bóng đá và quản trị thể thao thuộc đề tài **"Xây dựng hệ thống quản lý sân bóng đá nhân tạo Hải Châu, Đà Nẵng"**, được xây dựng trên nền tảng **React Native (Expo SDK 58)** kết nối trực tiếp với hệ thống **Django REST Framework Backend**.

---

## 📑 Mục lục
1. [Kiến trúc tổng quan hệ sinh thái](#1-kiến-trúc-tổng-quan-hệ-sinh-thái)
2. [Cấu trúc thư mục dự án Mobile](#2-cấu-trúc-thư-mục-dự-án-mobile)
3. [Tech Stack (Mobile & Backend)](#3-tech-stack-mobile--backend)
4. [Hệ thống Backend & Cơ sở dữ liệu (10 Django Apps, 14 Models)](#4-hệ-thống-backend--cơ-sở-dữ-liệu-10-django-apps-14-models)
5. [Hệ thống API Endpoints kết nối](#5-hệ-thống-api-endpoints-kết-nối)
6. [Cơ chế Xác thực (Auth) & Phân quyền (RBAC)](#6-cơ-chế-xác-thực-auth--phân-quyền-rbac)
7. [Các màn hình & Luồng nghiệp vụ trên Mobile App](#7-các-màn-hình--luồng-nghiệp-vụ-trên-mobile-app)
8. [Cấu hình IP mạng & Kết nối Backend](#8-cấu-hình-ip-mạng--kết-nối-backend)
9. [Quy trình từng bước xây dựng App từ đầu (Step-by-Step Development)](#9-quy-trình-từng-bước-xây-dựng-app-từ-đầu-step-by-step-development)
10. [Hướng dẫn cài đặt & Chạy thử nghiệm (Development Mode)](#10-hướng-dẫn-cài-đặt--chạy-thử-nghiệm-development-mode)
11. [Hướng dẫn đóng gói & Xuất bản App (Build APK / AAB / iOS)](#11-hướng-dẫn-đóng-gói--xuất-bản-app-build-apk--aab--ios)

---

## 1. Kiến trúc tổng quan hệ sinh thái

Hệ thống **Sân Bóng Đá Hải Châu, Đà Nẵng** vận hành theo mô hình Client-Server đa nền tảng:

```text
               ┌────────────────────────────────────────────────────────┐
               │        Django REST API Backend (Python 4.2.7)          │
               │   10 Apps - PostgreSQL - VietQR - Signals - Geocoding   │
               └───────────────────────┬────────────────────────────────┘
                                       │
                      ▲                │                ▲
                      │ (HTTP/JSON)    │ (HTTP/JSON)    │ (Webhook)
                      │                │                │
       ┌──────────────┴────────┐       │       ┌────────┴────────┐
       │     Web Frontend      │       │       │  SePay Webhook  │
       │   (React 18.2 SPA)    │       │       │ (Napas 24/7 QR) │
       │  Client & Admin Web   │       │       └─────────────────┘
       └───────────────────────┘       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     Mobile Application        │
                       │   (React Native Expo SDK 58)  │
                       │    iOS & Android Smart App    │
                       └───────────────────────────────┘
```

- **Backend (`football-booking-system/backend`)**: Cung cấp 60+ REST APIs, lưu trữ cơ sở dữ liệu PostgreSQL, xử lý logic thanh toán VietQR / SePay, tự động phát thông báo & voucher qua Django Signals.
- **Web Frontend (`football-booking-system/frontend`)**: Giao diện Web (React SPA) phục vụ đặt sân trực tuyến và hệ thống quản trị chuyên sâu (**Admin Console** 9 roles).
- **Mobile App (`football-mobile-app`)**: Ứng dụng di động độc lập (iOS & Android) tối ưu hóa trải nghiệm khách hàng: tra cứu sân bóng nhanh, đặt lịch trực quan, xem lịch sử đặt sân, quản lý hồ sơ và thanh toán tức thì.

---

## 2. Cấu trúc thư mục dự án Mobile

```text
football-mobile-app/
├── assets/                       # Icon, splash screen, ảnh tĩnh
├── src/
│   ├── api/                      # 7 Module kết nối API Backend hoàn chỉnh
│   │   ├── axiosClient.js        # Axios instance, BaseURL & tự động gắn headers (X-User-Role, X-User-Id)
│   │   ├── authApi.js            # API Đăng nhập / Đăng ký
│   │   ├── fieldsApi.js          # API Danh sách sân & Chi tiết sân bóng
│   │   ├── timeslotsApi.js       # API Khung giờ trống theo ngày
│   │   ├── servicesApi.js        # API Dịch vụ tiện ích (Nước uống, áo bib, giày)
│   │   ├── vouchersApi.js        # API Danh sách voucher & Kiểm tra mã giảm giá
│   │   ├── bookingsApi.js        # API Tạo đơn đặt sân, Lịch sử, Tra cứu & Check-in
│   │   ├── paymentsApi.js        # API Sinh mã VietQR & Polling trạng thái thanh toán Napas 24/7
│   │   └── facilityApi.js        # API Vận hành: Vệ sinh sân, Bảo trì sự cố & Đồ thất lạc
│   ├── components/               # Component tái sử dụng
│   ├── config.js                 # Cấu hình IP và BASE_URL kết nối Backend Django
│   ├── context/
│   │   └── AuthContext.js        # Quản lý phiên đăng nhập và định danh Role qua AsyncStorage
│   ├── navigation/
│   │   └── AppNavigator.js       # Điều hướng React Navigation (BottomTabs động theo Role + Stack Screens)
│   └── screens/                  # 9 Màn hình chức năng hoàn chỉnh
│       ├── HomeScreen.js         # Trang chủ: Banner, tìm kiếm, lọc loại sân, danh sách sân
│       ├── FieldDetailScreen.js  # Chi tiết cụm sân: Album 4 ảnh, tiện ích, giờ mở cửa, giá thuê
│       ├── BookingScreen.js      # Quy trình đặt sân: Chọn ngày, chọn khung giờ, thêm dịch vụ, voucher
│       ├── PaymentScreen.js      # Thanh toán VietQR Napas 24/7, countdown 15p, Smart Polling 3s
│       ├── LookupScreen.js       # Tra cứu đơn đặt sân nhanh qua SĐT/mã đơn + Mã QR check-in
│       ├── BookingsScreen.js     # Lịch sử đặt sân của người dùng, lọc trạng thái, thanh toán lại
│       ├── ProfileScreen.js      # Hồ sơ tài khoản, vai trò hệ thống, phím tắt vào trung tâm vận hành
│       ├── CleaningScreen.js     # [Staff/Cleaner] Quản lý ca dọn sân, cập nhật trạng thái sạch sẽ
│       ├── MaintenanceScreen.js  # [Staff/Maintenance] Báo cáo sự cố thiết bị & cập nhật tiến độ sửa
│       ├── StaffBookingsScreen.js# [Staff/Lễ tân] Quản lý đơn sân, Check-in khách vào sân thi đấu
│       ├── StaffOperationsScreen.js # [Staff Hub] Trung tâm điều phối tác vụ chuyên trách theo Role
│       └── LoginScreen.js        # Modal đăng nhập nhanh bằng Email hoặc Số điện thoại
├── App.js                        # Điểm khởi chạy chính (Root Component + AuthProvider)
├── app.json                      # Cấu hình Expo Project & Package Name
├── eas.json                      # Cấu hình build APK Android độc lập
├── package.json                  # Khai báo Dependencies & Scripts
└── README.md                     # Tài liệu hướng dẫn dự án
```

---

## 3. Tech Stack (Mobile & Backend)

### Mobile App (Client):
- **Core Framework**: React Native `0.88.1`, React `19.3.0`
- **Platform & Tooling**: Expo SDK `58.0.23` (Hỗ trợ Expo Go, EAS Build)
- **Navigation**: React Navigation v7 (`@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`)
- **HTTP Client**: Axios `1.21.0` (kèm Interceptors chèn `X-User-Role` và `X-User-Id`)
- **Local Storage**: `@react-native-async-storage/async-storage` (Lưu phiên đăng nhập và định danh người dùng)
- **Icons & UI**: `@expo/vector-icons` (Ionicons), Safe Area Context, Screens

### Backend API (Hệ thống kết nối):
- **Framework**: Django `4.2.7`, Django REST Framework `3.16.1`
- **Database**: PostgreSQL (kết nối qua `psycopg2-binary`, cấu hình `dj-database-url`)
- **Thanh toán**: VietQR, SePay Webhook (Napas 24/7)
- **Xử lý ảnh & QR**: Pillow `10.4.0`, qrcode `8.2`
- **Địa lý & Tọa độ**: Nominatim Geocoding API, OpenStreetMap

---

## 4. Hệ thống Backend & Cơ sở dữ liệu (10 Django Apps, 14 Models)

Ứng dụng Mobile tương tác trực tiếp với 14 models trải dài trên 10 Django Apps:

| Model | Bảng DB | Ứng dụng & Chức năng | Các trường chính |
|---|---|---|---|
| **Customers** | `customers` | Quản lý tài khoản khách hàng & nhân sự | `id (UUID)`, `full_name`, `phone`, `email`, `password_hash`, `role` (9 choices), `is_active` |
| **Admin** | `admins` | Tài khoản quản trị cấp cao | `id (UUID)`, `phone`, `password_hash`, `role` |
| **RolePermission** | `role_permissions` | Ma trận quyền động RBAC | `role`, `permissions (JSONField)`, `updated_at` |
| **FieldTypes** | `field_types` | Phân loại sân (5 người, 7 người, 11 người) | `id (UUID)`, `name`, `description` |
| **FootballFields** | `football_fields` | Thông tin cụm sân bóng, giá thuê, ảnh | `id (UUID)`, `field_name`, `field_type`, `location`, `address`, `lat/lng`, `price_per_hour`, `peak_price`, `off_peak_price`, `image`, `sub_image_1..3`, `is_available`, `rating_avg`, `open/close_time` |
| **FieldSchedules**| `field_schedules` | Lịch mở cửa hoạt động theo ngày | `id (UUID)`, `field`, `work_date`, `start_time`, `end_time` |
| **TimeSlots** | `time_slots` | Khung giờ chi tiết, trạng thái còn/hết | `id (UUID)`, `field`, `slot_date`, `start_time`, `end_time`, `price`, `status` (`available`/`booked`) |
| **Bookings** | `bookings` | Đơn đặt sân bóng đá | `id (UUID)`, `customer`, `field`, `booking_date`, `start/end_time`, `total_price`, `discount_amount`, `voucher_code`, `status`, `notes` |
| **BookingLogs** | `booking_logs` | Lịch sử nhật ký thay đổi đơn | `id (UUID)`, `booking`, `action`, `performed_by`, `old_value`, `new_value`, `timestamp` |
| **TournamentRequests** | `tournament_requests` | Đăng ký tổ chức giải đấu trọn gói | `id (UUID)`, `customer`, `tournament_name`, `org`, `expected_teams`, `dates`, `budget`, `status`, `payment_method` |
| **Payments** | `payments` | Giao dịch thanh toán VietQR / SePay | `id (UUID)`, `booking`, `customer`, `amount`, `payment_method`, `status`, `transaction_id`, `payment_date` |
| **Voucher** | `vouchers` | Mã giảm giá & quà tặng | `id (UUID)`, `code`, `title`, `discount_type`, `discount_value`, `max_discount`, `min_booking_price`, `is_system_reward`, `is_active` |
| **CustomerVoucher**| `customer_vouchers` | Ví voucher của khách hàng | `id (UUID)`, `customer`, `voucher`, `code`, `is_used`, `used_at`, `valid_until` |
| **ServicesAdd** | `servicesadd` | Dịch vụ bán kèm (Nước uống, Áo bib, Giày) | `id (UUID)`, `name`, `price`, `description`, `image`, `category`, `stock`, `is_active` |
| **BookingServices**| `booking_services` | Chi tiết dịch vụ đi kèm theo đơn | `id (UUID)`, `booking`, `service`, `quantity`, `total_price`, `shoe_size` |
| **Reviews** | `reviews` | Đánh giá & nhận xét sau trận đấu | `id (Int)`, `user`, `field`, `booking`, `rating` (1-5 ⭐), `comment` |
| **Notification** | `notifications` | Thông báo tự động đẩy từ Signals | `id (UUID)`, `user`, `booking`, `notification_type`, `title`, `message`, `is_read` |
| **Facility Models**| `facility_*` | Vệ sinh, Bảo trì sự cố & Đồ thất lạc | `PitchCleaning`, `MaintenanceIssue`, `LostFoundItem` |

---

## 5. Hệ thống API Endpoints kết nối

Mobile App gọi tới các Endpoints của Backend thông qua `src/api/axiosClient.js`:

### 👤 Xác thực & Tài khoản (`/api/users/`)
- `POST /api/users/login/` — Đăng nhập bằng Email/SĐT + Mật khẩu
- `POST /api/users/register/` — Đăng ký tài khoản mới
- `POST /api/users/check-exists/` — Kiểm tra SĐT/Email đã tồn tại
- `POST /api/users/create-guest/` — Tạo tài khoản khách (Guest) đặt sân nhanh
- `GET /api/users/profile/` — Lấy thông tin tài khoản hiện tại

### ⚽ Sân bóng & Lịch hoạt động (`/api/`)
- `GET /api/football-fields/` — Lấy danh sách sân bóng (kèm bộ lọc địa điểm, loại sân)
- `GET /api/football-fields/<uuid>/` — Chi tiết cụm sân (Ảnh, tiện ích, bản đồ tọa độ)
- `GET /api/seed-field-types/` — Danh sách phân loại sân (5v5, 7v7, 11v11)
- `GET /api/timeslots/field/<field_id>/date/<date>/` — Lấy danh sách khung giờ trống

### 📅 Đặt sân & Lịch sử (`/api/bookings/`)
- `POST /api/bookings/create/` — Tạo đơn đặt sân bóng mới
- `GET /api/bookings/` — Lấy toàn bộ danh sách đơn đặt sân (hỗ trợ phân quyền)
- `GET /api/bookings/user/<uuid>/` — Lịch sử đặt sân theo từng khách hàng
- `GET /api/bookings/lookup/?phone=...&code=...` — Tra cứu đơn nhanh không cần đăng nhập
- `GET /api/bookings/customer-limits/` — Kiểm tra giới hạn chống spam đơn đặt trong ngày

### 💳 Thanh toán & Voucher (`/api/payments/`, `/api/vouchers/`)
- `POST /api/payments/qr/create/` — Sinh mã VietQR thanh toán ngân hàng Napas 24/7
- `GET /api/payments/status/<booking_id>/` — Kiểm tra trạng thái thanh toán đơn hàng
- `GET /api/vouchers/` — Danh sách mã voucher khuyến mãi khả dụng
- `POST /api/vouchers/validate/` — Kiểm tra & áp dụng mã voucher cho đơn đặt sân

---

## 6. Cơ chế Xác thực (Auth) & Phân quyền (RBAC)

1. **Quản lý phiên (Session Management)**:
   - Thông tin người dùng sau khi đăng nhập thành công được lưu trữ an toàn trong **AsyncStorage** dưới khóa `user`.
   - `AuthContext.js` cung cấp trạng thái `user`, `login()`, `logout()` cho toàn bộ màn hình ứng dụng.
2. **Cơ chế xác thực qua Header**:
   - `axiosClient.js` tự động đọc thông tin user từ `AsyncStorage`.
   - Đính kèm 2 Headers vào mọi request gửi lên Backend:
     - `X-User-Role`: Quyền của người dùng (`customer`, `admin`, `field_manager`...).
     - `X-User-Id`: UUID của tài khoản.
   - Giúp đồng bộ hoàn toàn với cơ chế bảo mật phân quyền RBAC `@permission_required` của Backend Django.

---

## 7. Các màn hình & Luồng nghiệp vụ trên Mobile App

### 🏠 1. Màn hình Trang chủ (HomeScreen)
- **Hero Banner & Nút Tra cứu nhanh**: Chào mừng người chơi, nút tra cứu đơn nhanh trên đầu trang.
- **Thanh tìm kiếm & Bộ lọc nhanh**: Lọc theo khu vực và loại sân (Sân 5, Sân 7, Sân 11).
- **Danh sách sân bóng**: Hiển thị ảnh đại diện, tên sân, địa chỉ, giá/giờ, bấm thẻ để xem chi tiết hoặc bấm "Đặt ngay".

### 🏟️ 2. Màn hình Chi tiết Sân bóng (FieldDetailScreen)
- **Album Gallery 4 ảnh**: Xem ảnh chính và các góc sân phụ (`sub_image_1..3`).
- **Thông tin chi tiết**: Loại sân, số lượt đặt, điểm đánh giá sao, địa chỉ đầy đủ, giờ mở/đóng cửa và hotline.
- **Tiện ích sân**: Nước uống, thuê áo bib, thuê giày có size, bãi đỗ xe, wifi, đèn LED.
- **Thanh đặt sân cố định**: Bấm "Đặt sân ngay" chuyển sang quy trình giữ chỗ.

### ⚽ 3. Màn hình Đặt sân & Khung giờ (BookingScreen)
- **Chọn ngày thi đấu**: Thanh cuộn chọn nhanh 10 ngày kế tiếp.
- **Chọn khung giờ trống**: Tải khung giờ từ API theo ngày, chọn tối đa 3 slot/ngày, hiển thị slot đã đặt.
- **Dịch vụ đi kèm**: Tăng giảm số lượng nước ngọt, nước khoáng, áo bib thi đấu, giày.
- **Áp dụng Voucher**: Nhập mã giảm giá và kiểm tra tính hợp lệ qua API.
- **Thông tin người đặt**: Tự động điền họ tên, số điện thoại từ tài khoản đăng nhập.
- **Tổng kết tiền**: Tự động tính toán (Tiền sân + Dịch vụ - Voucher) và bấm "Thanh toán VietQR".

### 💳 4. Màn hình Thanh toán VietQR Napas 24/7 (PaymentScreen)
- **Mã QR động SePay**: Hiển thị mã VietQR chuẩn ngân hàng với số tiền và nội dung chuyển khoản tự động.
- **Đồng hồ đếm ngược**: 15:00 phút trước khi đơn tự hủy.
- **Smart Polling 3s**: Tự động lắng nghe tín hiệu chuyển khoản thành công từ ngân hàng và chuyển trang chúc mừng.

### 🔍 5. Màn hình Tra cứu Đơn đặt (LookupScreen)
- **Không cần đăng nhập**: Chỉ cần nhập số điện thoại hoặc mã đơn (ví dụ: `BK12345678`).
- **Xem chi tiết & QR Check-in**: Xuất trình mã QR cho nhân viên lễ tân khi đến sân.
- **Nút thanh toán tức thì**: Nếu đơn còn `Pending`, có thể bấm thanh toán ngay bằng VietQR.

### 📅 6. Màn hình Lịch đặt của tôi (BookingsScreen)
- Hiển thị danh sách các trận bóng đã đặt của người dùng.
- Bộ lọc: Tất cả, Đã xác nhận (`confirmed`), Hoàn thành (`completed`), Chờ thanh toán (`pending`).
- Kéo để làm mới (Pull-to-Refresh) và nút thanh toán nhanh.

### 🧹 7. Màn hình Quản lý Vệ sinh Sân (CleaningScreen - Dành cho Cleaner / Staff)
- Danh sách các ca dọn dẹp sân bãi sau khi trận đấu kết thúc.
- Bộ lọc: Cần dọn (`needs_clean`), Đang dọn (`in_progress`), Đã sạch (`clean`).
- Nút bấm thao tác 1 chạm: "Bắt đầu dọn", "Hoàn thành sạch sẽ", "Báo dọn lại".

### 🛠️ 8. Màn hình Bảo trì Sự cố Thiết bị (MaintenanceScreen - Dành cho Kỹ thuật / Quản lý)
- Danh sách sự cố mặt cỏ, khung thành, lưới, đèn chiếu sáng, cấp thoát nước.
- Huy hiệu mức độ khẩn cấp: Khẩn cấp (Đỏ), Cao (Cam), Bình thường (Vàng), Thấp (Xám).
- Modal tạo báo cáo sự cố mới kèm dự toán chi phí (VNĐ).
- Cập nhật tiến độ: Bắt đầu sửa → Hoàn thành khắc phục.

### 📋 9. Màn hình Lễ tân & Check-in Khách (StaffBookingsScreen - Dành cho Lễ tân / Thu ngân)
- Tìm kiếm nhanh đơn đặt sân của khách theo tên, SĐT hoặc mã đơn.
- Nút Check-in 1 chạm: Xác nhận khách đã đến sân, chuyển trạng thái "Đã xác nhận".
- Xác nhận kết thúc trận đấu và hoàn thành đơn.

### 🏢 10. Trung tâm Vận hành Tác vụ (StaffOperationsScreen)
- Hub điều phối chuyên biệt hiển thị tự động trên thanh Bottom Tab khi đăng nhập tài khoản có Role nhân viên / quản trị.
- Cung cấp phím tắt truy cập nhanh vào đúng các chức năng theo phân quyền của Role đó.

### 👤 11. Màn hình Tài khoản (ProfileScreen) & Đăng nhập (LoginScreen)
- Hiển thị thông tin người dùng, Huy hiệu Role chính thức, nút truy cập Trung tâm vận hành.
- Modal đăng nhập bảo mật bằng Email hoặc Số điện thoại.

---

## 8. Cấu hình IP mạng & Kết nối Backend

File cấu hình: `src/config.js`

```javascript
// src/config.js
export const BASE_URL = 'http://192.168.89.235:8000/api';
export const MEDIA_URL = 'http://192.168.89.235:8000';
```

> [!IMPORTANT]
> **Các chế độ kết nối quan trọng:**
> 1. **Chạy trên điện thoại thật (qua Expo Go)**:
>    - Máy tính và điện thoại **bắt buộc phải kết nối chung 1 mạng Wi-Fi**.
>    - Đổi `192.168.89.235` thành địa chỉ IPv4 LAN hiện tại của máy tính của bạn (kiểm tra bằng lệnh `ipconfig` trên Windows Terminal).
> 2. **Chạy trên máy ảo Android (Android Studio Emulator)**:
>    - Sử dụng địa chỉ: `http://10.0.2.2:8000/api`.
> 3. **Chạy qua đường hầm Online (LocalTunnel / Ngrok)**:
>    - Khi máy tính và điện thoại không cùng mạng Wi-Fi, chạy tunnel trên Backend:
>      ```bash
>      npx localtunnel --port 8000 --subdomain football-dinhbac
>      ```
>    - Đổi `BASE_URL` thành: `https://football-dinhbac.loca.lt/api`.

---

## 9. Quy trình từng bước xây dựng App từ đầu (Step-by-Step Development)

Dưới đây là 7 bước kỹ thuật để tạo dựng toàn bộ dự án `football-mobile-app` từ con số 0:

### Bước 1: Khởi tạo Project Expo SDK mới
Khởi tạo cấu trúc dự án React Native bằng Expo:
```bash
npx create-expo-app@latest football-mobile-app --template blank
cd football-mobile-app
```

### Bước 2: Cài đặt các thư viện phụ thuộc tương thích Expo SDK 58
Sử dụng `npx expo install` để bảo đảm các phiên bản thư viện Native tương thích hoàn hảo:
```bash
# 1. Điều hướng và Quản lý màn hình
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context

# 2. Lưu trữ cục bộ & Icon
npx expo install @react-native-async-storage/async-storage @expo/vector-icons

# 3. HTTP Client gọi REST API
npm install axios
```

### Bước 3: Thiết lập Cấu hình IP & Axios Client Interceptors
- Tạo `src/config.js` định nghĩa `BASE_URL` và `MEDIA_URL`.
- Tạo `src/api/axiosClient.js`: Cấu hình request interceptor tự động lấy token/user từ `AsyncStorage` và đính kèm `X-User-Role`, `X-User-Id` vào HTTP Headers.

### Bước 4: Xây dựng các Module gọi API Backend
Tạo các file giao tiếp dữ liệu trong `src/api/`:
- `authApi.js`: Hàm `loginApi`, `registerApi`.
- `fieldsApi.js`: Hàm `getFieldsApi`, `getFieldDetailApi`.
- `bookingsApi.js`: Hàm `getBookingsApi`, `createBookingApi`.

### Bước 5: Tạo State Management toàn cục (`AuthContext.js`)
- Tạo `src/context/AuthContext.js` sử dụng React Context API.
- Tự động kiểm tra `AsyncStorage.getItem('user')` khi mở app để khôi phục phiên đăng nhập.
- Cung cấp hàm `login(userData)` và `logout()` cho toàn bộ cây component.

### Bước 6: Xây dựng Hệ thống Điều hướng (`AppNavigator.js`)
- Tạo Bottom Tab Navigator với 3 tab chính: **Trang chủ (`HomeScreen`)**, **Lịch đặt (`BookingsScreen`)**, **Tài khoản (`ProfileScreen`)**.
- Bọc ngoài bằng Native Stack Navigator để hiển thị **Màn hình Đăng nhập (`LoginScreen`)** dạng Modal trượt từ dưới lên (`presentation: 'modal'`).

### Bước 7: Hoàn thiện các Màn hình Giao diện
- `HomeScreen.js`: Lấy danh sách sân từ `fieldsApi`, tìm kiếm theo tên sân/quận, lọc theo sân 5/7/11.
- `BookingsScreen.js`: Gọi `bookingsApi`, hiển thị thẻ trận đấu, badge trạng thái, tích hợp `RefreshControl` để kéo làm mới dữ liệu.
- `ProfileScreen.js`: Hiển thị chi tiết khách hàng, nút đổi tài khoản hoặc đăng xuất.
- `LoginScreen.js`: Form nhập liệu email/phone + password, gọi `authApi.loginApi` và cập nhật Context.

---

## 10. Hướng dẫn cài đặt & Chạy thử nghiệm (Development Mode)

### Bước 1: Khởi động Backend Django
Mở Terminal tại thư mục `football-booking-system/backend`:
```bash
cd "D:\Football  Booking System\football-booking-system\backend"
python manage.py runserver 0.0.0.0:8000
```

### Bước 2: Khởi động Mobile App (Expo Metro Bundler)
Mở Terminal tại thư mục `football-mobile-app`:
```bash
cd "D:\football-mobile-app"
npm install
npx expo start
```

### Bước 3: Trải nghiệm trên thiết bị
1. **Trên điện thoại thật (Khuyên dùng)**:
   - Cài app **Expo Go** từ Google Play (Android) hoặc App Store (iOS).
   - Dùng camera (iOS) hoặc quét mã QR trong app Expo Go (Android) để nạp ứng dụng.
2. **Trên máy ảo Android**: Bấm phím `a` trên bàn phím Terminal.
3. **Trên trình duyệt Web**: Bấm phím `w` trên bàn phím Terminal.

---

## 11. Hướng dẫn đóng gói & Xuất bản App (Build APK / AAB / iOS)

Khi muốn đóng gói app thành file cài đặt độc lập (không cần chạy qua Expo Go), sử dụng công cụ **EAS Build (Expo Application Services)**:

### Bước 1: Cài đặt EAS CLI & Đăng nhập
```bash
npm install -g eas-cli
eas login
```
*(Nếu chưa có tài khoản, đăng ký miễn phí tại [expo.dev](https://expo.dev))*

### Bước 2: Khởi tạo cấu hình EAS Build
Chạy lệnh khởi tạo file cấu hình:
```bash
eas build:configure
```
Hệ thống sẽ tạo ra file `eas.json` tại thư mục gốc.

### Bước 3: Cấu hình xuất file APK (Cài trực tiếp trên điện thoại Android)
Mở file `eas.json` và bổ sung cấu hình `preview` như sau:
```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Bước 4: Chạy lệnh đóng gói (Build)

* **Build file APK Android (Cài trực tiếp để test hoặc chia sẻ qua Zalo/Drive)**:
  ```bash
  eas build -p android --profile preview
  ```
  *Hệ thống Cloud của Expo sẽ tự động biên dịch và trả về link tải file `.apk` cài đặt trực tiếp lên điện thoại.*

* **Build file AAB Android (Để xuất bản lên Google Play Store)**:
  ```bash
  eas build -p android --profile production
  ```

* **Build ứng dụng iOS (IPA / TestFlight)**:
  ```bash
  eas build -p ios --profile production
  ```
  *(Yêu cầu tài khoản Apple Developer)*

---

**⚽ Sân Bóng Đá Hải Châu, Đà Nẵng — Quản lý vận hành cụm sân hiệu quả!**
