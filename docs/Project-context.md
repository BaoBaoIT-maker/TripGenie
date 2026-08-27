Hệ thống: TripGenie  — Nền tảng Lập kế hoạch Du lịch Thông minh & Cộng tác Thời gian thực
==================================================
1. TỔNG QUAN ĐỀ TÀI
==================================================

Xây dựng một nền tảng Travel Recommendation & AI Itinerary Planner.

Người dùng có thể:

- Tìm kiếm địa điểm du lịch.
- Tìm các địa điểm phù hợp với sở thích.
- Tìm các địa điểm gần một vị trí.
- Lọc theo giá.
- Lọc theo rating.
- Lọc theo category.
- Lọc theo khoảng cách.
- Lưu địa điểm yêu thích.
- Nhập yêu cầu du lịch bằng ngôn ngữ tự nhiên.
- Nhận recommendation cá nhân hóa.
- Tự động tạo itinerary nhiều ngày.
- Tối ưu thứ tự di chuyển.
- Xem itinerary trên bản đồ.
- Chat với AI Travel Assistant.
- Điều chỉnh itinerary bằng ngôn ngữ tự nhiên.

Ví dụ:

User nhập:

"Tôi đi Đà Nẵng 3 ngày, ngân sách khoảng 3 triệu, thích biển, ăn uống và những nơi đẹp để chụp ảnh, không muốn di chuyển quá xa."

Hệ thống cần:

1. Hiểu user intent.
2. Extract các preference thành dữ liệu có cấu trúc.
3. Tìm các candidate places.
4. Filter theo điều kiện.
5. Semantic search.
6. Ranking.
7. Spatial clustering.
8. Route optimization.
9. Tạo itinerary.
10. Dùng AI để giải thích và trình bày itinerary.


==================================================
2. TECH STACK
==================================================

Backend:

- NestJS
- TypeScript
- PostgreSQL
- PostGIS
- pgvector
- Redis
- BullMQ

AI:

- LLM provider abstraction.
- Có thể sử dụng Gemini hoặc OpenAI.
- Embedding model.
- RAG.
- Agentic AI / Tool Calling.

Routing:

Có thể sử dụng:

- OSRM
- OpenRouteService
- GraphHopper
- hoặc routing provider phù hợp.

Frontend chưa cần triển khai ngay.

Tập trung thiết kế backend và data architecture.
==================================================
3. REQUIREMENTS
==================================================

STT	Công việc	Loại công việc	Quy định / Công thức	Ghi chú
1	Đăng ký & Kích hoạt tài khoản (OTP)	Lưu trữ	QĐ-1	Xác thực email qua OTP 6 số, hết hạn sau 10 phút (UC01)
2	Đăng nhập hệ thống (Local / OAuth2)	Lưu trữ	QĐ-1	Hỗ trợ Local (Email + Mật khẩu) và Google OAuth2 (UC02)
3	Cập nhật Khẩu vị & Hồ sơ du lịch	Lưu trữ	QĐ-1	Cài đặt ngân sách, dị ứng ăn uống, sở thích du lịch (UC03)
4	Quản lý danh mục & địa điểm (Admin)	Lưu trữ	QĐ-2	CRUD địa điểm, quản lý giờ mở cửa, khung giá, tọa độ (UC04)
5	Tải lên & Quản lý Media địa điểm	Lưu trữ	QĐ-2	Tải lên nhiều ảnh, thiết lập ảnh đại diện chính (UC05)
6	Tự động Vector hóa địa điểm (Embedding)	Tính toán	QĐ-3	Worker nền tự động tạo vector 1536 chiều khi cập nhật địa điểm (UC06)
7	Tìm kiếm địa lý theo bán kính (PostGIS)	Tra cứu	QĐ-4	Tìm địa điểm xung quanh vị trí GPS trong bán kính R mét (UC07)
8	Tìm kiếm ngữ nghĩa (pgvector Search)	Tra cứu	QĐ-3	Tìm kiếm theo cảm xúc, mô tả tự nhiên với Cosine Distance (UC08)
9	Tìm kiếm kết hợp đa chiều (Hybrid Search)	Tra cứu	QĐ-3, QĐ-4	Kết hợp lọc không gian, vector ngữ nghĩa và bộ lọc giá/danh mục (UC09)
10	Trò chuyện tư vấn du lịch với AI (SSE Stream)	Tra cứu	QĐ-5	Phản hồi dạng Stream từng token theo thời gian thực (UC10)
11	AI Agent tự động gọi công cụ (Tool Calling)	Tính toán	QĐ-5	AI tự động gọi Tool tìm kiếm địa điểm và tính toán lộ trình (UC11)
12	Tự động khởi tạo & Lưu lịch trình từ AI	Lưu trữ	QĐ-5, QĐ-6	AI Agent sinh dữ liệu và lưu trực tiếp thành đối tượng Itinerary (UC12)
13	Quản lý & Tóm tắt bộ nhớ hội thoại AI	Tính toán	QĐ-5	Tự động tóm tắt tin nhắn cũ để tối ưu token ngữ cảnh (UC13)
14	Tự tạo & Chỉnh sửa lịch trình thủ công	Lưu trữ	QĐ-6	Kéo thả sắp xếp thứ tự điểm đến theo ngày (UC14)
15	Khởi tạo nhóm chuyến đi & Quản lý mã mời	Lưu trữ	QĐ-7	Tạo nhóm từ lịch trình, cấp mã mời ngẫu nhiên duy nhất (UC15)
16	Đề xuất địa điểm vào chuyến đi nhóm	Lưu trữ	QĐ-7	Thành viên đề xuất điểm đến vào danh sách chờ duyệt (UC16)
17	Bình chọn điểm đến thời gian thực (WebSocket)	Tính toán	QĐ-7	Bình chọn/Hủy bình chọn, đồng bộ tức thì qua Socket.IO (UC17)
18	Đánh giá & Viết nhận xét địa điểm	Lưu trữ	QĐ-2	Chấm điểm 1–5 sao, gửi nhận xét và hình ảnh thực tế (UC18)
19	Đăng lịch trình lên Bảng tin cộng đồng	Lưu trữ	QĐ-8	Công khai lịch trình thành bài viết chia sẻ kinh nghiệm (UC19)
20	Lướt Bảng tin cộng đồng (Cursor Feed)	Tra cứu	QĐ-8	Phân trang vô tận tối ưu hiệu năng theo con trỏ thời gian (UC20)
21	Nhân bản toàn vẹn lịch trình (Clone Trip)	Lưu trữ	QĐ-8	Sao chép sâu toàn bộ điểm đến sang tài khoản cá nhân qua Transaction (UC21)
22	Quản lý người dùng & Hệ thống (Admin)	Lưu trữ	QĐ-1	Khóa/Mở tài khoản, theo dõi số liệu hoạt động toàn hệ thống (UC22)