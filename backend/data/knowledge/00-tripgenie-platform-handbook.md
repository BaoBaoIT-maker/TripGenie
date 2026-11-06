---
title: "Cẩm Nang Hướng Dẫn Sử Dụng & Quy Chế Nền Tảng TripGenie"
source_type: "platform_faq"
category_tags: ["platform", "faq", "guide", "trip-group", "permissions", "planner", "community"]
sources:
  - "https://tripgenie.vn/help"
last_updated: "2026-10-12"
language: "vi"
---

# Cẩm Nang Hướng Dẫn Sử Dụng & Quy Chế Nền Tảng TripGenie

TripGenie là nền tảng du lịch thông minh tích hợp AI và dữ liệu không gian địa lý (PostGIS), hỗ trợ du khách khám phá hệ thống địa điểm du lịch xác thực tại Việt Nam, lập lịch trình tự động tối ưu đường đi và lên kế hoạch du lịch nhóm.

## 1. Hệ Thống Lập Lịch Trình AI Tự Động (AI Itinerary Planner)

### Quy Trình Tạo Chuyến Đi Mới (`/planner`)
- Người dùng truy cập đường dẫn `/planner` để khởi tạo lịch trình mới.
- Các thông số đầu vào gồm: Điểm xuất phát, Điểm đến (34 tỉnh/thành phố Việt Nam), Ngày khởi hành và ngày kết thúc, Ngân sách dự kiến (`LOW` - Bình dân, `MEDIUM` - Vừa phải, `HIGH` - Cao cấp, `LUXURY` - Nghỉ dưỡng sang trọng), Nhịp độ di chuyển (`RELAXED` - Thư giãn 2-3 điểm/ngày, `BALANCED` - Cân bằng 4-5 điểm/ngày, `PACKED` - Khám phá dày đặc 6-7 điểm/ngày) và Phương tiện di chuyển.
- Hệ thống tự động phân bổ hoạt động theo khung giờ sáng, trưa, chiều, tối kết hợp thuật toán định tuyến địa lý để tránh di chuyển lòng vòng (anti-zigzag routing) và ước tính chi phí vé tham quan, ăn uống, di chuyển.

### Trợ Lý Biên Tập Lịch Trình (Genie Copilot)
- Bên trong trang chi tiết lịch trình (`/itinerary/:id`), người dùng có thể mở ngăn kéo **Genie Copilot** để yêu cầu chỉnh sửa lịch trình bằng ngôn ngữ tự nhiên.
- Các thao tác Copilot hỗ trợ: Đổi một địa điểm sang quán ăn/điểm tham quan khác (`swap_activity`), thêm hoạt động mới vào ngày cụ thể (`add_activity`), xóa hoạt động (`remove_activity`), chuyển hoạt động sang ngày khác (`move_activity`), hoặc hoán đổi toàn bộ lịch trình giữa hai ngày (`swap_days`).

## 2. Quy Chế Du Lịch Nhóm, Phân Quyền & Bỏ Phiếu (Trip Groups & Voting)

### Cách Mời Bạn Bè Tham Gia Chuyến Đi
- Mỗi lịch trình khi kích hoạt chế độ nhóm sẽ có một **Mã Mời (Invite Code)** duy nhất tại tab **"Nhóm & Thành viên"**.
- Người dùng sao chép mã mời này gửi cho bạn đồng hành. Mỗi nhóm hỗ trợ tối đa mặc định **10 thành viên** (có thể cấu hình mở rộng tùy chuyến đi).

### Phân Quyền Thành Viên Trong Nhóm (Group Roles)
Hệ thống áp dụng 3 cấp độ phân quyền chặt chẽ để bảo vệ toàn vẹn lịch trình:
- **Owner (Chủ chuyến đi)**: Là người tạo lịch trình ban đầu. Có toàn quyền quản trị cao nhất: chỉnh sửa mọi thông tin chuyến đi, duyệt hoặc từ chối đề xuất địa điểm, thay đổi quyền hạn thành viên, xóa thành viên khỏi nhóm, hoặc xóa toàn bộ lịch trình.
- **Editor (Biên tập viên)**: Có quyền thêm, sửa, đổi thứ tự các địa điểm trong lịch trình, đề xuất địa điểm mới và tham gia bỏ phiếu (vote). **Lưu ý quan trọng**: Editor **KHÔNG** có quyền xóa toàn bộ chuyến đi và **KHÔNG** có quyền xóa thành viên khác ra khỏi nhóm.
- **Viewer (Người xem)**: Chỉ có quyền xem lịch trình chi tiết, xem bản đồ di chuyển và tham gia bình chọn địa điểm; không thể trực tiếp thay đổi hay xóa các điểm trong lộ trình.

### Cơ Chế Đề Xuất & Bình Chọn Địa Điểm (Place Proposal & Voting)
- Khi đi theo nhóm, thành viên có thể đề xuất thêm một quán ăn hoặc điểm tham quan vào danh sách chờ (**Group Place Proposal**) ở trạng thái `PENDING`.
- Các thành viên trong nhóm thực hiện thả phiếu bầu (**Vote**). Chủ chuyến đi (`Owner`) hoặc biên tập viên (`Editor`) sẽ dựa trên số phiếu bầu cao nhất để bấm duyệt (`APPROVED`), tự động đưa địa điểm đó vào lộ trình chính thức của nhóm.

## 3. Khám Phá Địa Điểm, Bộ Sưu Tập & Cộng Đồng (`/explore` & `/community`)

### Tìm Kiếm & Lưu Bộ Sưu Tập Cá Nhân (`Collections`)
- Tại trang `/explore`, người dùng có thể lọc địa điểm theo 12 danh mục chuẩn (Điểm tham quan, Di tích lịch sử, Thiên nhiên & Biển, Nhà hàng, Cà phê, Ẩm thực đường phố, Vui chơi giải trí, Chợ & Mua sắm, Khách sạn, Homestay, Bar & Pub, Spa).
- Người dùng bấm biểu tượng **Bookmark (Lưu)** trên mỗi thẻ địa điểm để lưu vào **Bộ sưu tập cá nhân (Collections)** phục vụ cho việc lên kế hoạch sau này.

### Chia Sẻ Cộng Đồng & Nhân Bản Lịch Trình (`Clone Itinerary`)
- Tại trang `/community`, du khách có thể đăng tải chia sẻ các chuyến đi thực tế đã hoàn thành (ở chế độ `Public`).
- Người dùng khác có thể thả tim, bình luận hỏi kinh nghiệm, hoặc bấm nút **"Nhân bản lịch trình" (Clone)** để sao chép toàn bộ lộ trình đó về tài khoản cá nhân và tùy biến lại theo ngày đi của riêng mình.
