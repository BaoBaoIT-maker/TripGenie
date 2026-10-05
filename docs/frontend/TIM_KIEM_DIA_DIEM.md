# 📋 TÀI LIỆU YÊU CẦU GIAO DIỆN (UI/UX SPECIFICATION)
## Module: Khám Phá & Tìm Kiếm Địa Điểm Du Lịch (Places Discovery & Search Engine)
- **Đối tượng áp dụng**: Thành viên phụ trách Frontend (React / Next.js)
- **Mục tiêu**: Xây dựng màn hình tìm kiếm, lọc đa tiêu chí và khám phá địa điểm kết hợp bản đồ tương tác (tương tự trải nghiệm Airbnb / Google Maps / Tripadvisor).

---

## 1. Bố Cục Tổng Thể Trang (Layout Structure)

Trang tìm kiếm được chia theo cấu trúc **Split Screen (Màn hình chia đôi 2 cột)** tiêu chuẩn của các ứng dụng du lịch hàng đầu:

```
+-----------------------------------------------------------------------------------------+
| [HEADER / NAVBAR]: Logo TripGenie | Ô Tìm Kiếm Thông Minh (Search Bar) | User Profile   |
+-----------------------------------------------------------------------------------------+
| [QUICK FILTERS BAR]: [Tất cả] [☕ Cà phê] [🍜 Ẩm thực] [🏖️ Bãi biển] [🏛️ Tham quan] ...   |
+-------------------------------------------------------------+---------------------------+
| CỘT TRÁI (45% - 50% màn hình): DANH SÁCH & BỘ LỌC CHI TIẾT  | CỘT PHẢI (50% - 55%):     |
| - Thanh công cụ lọc & sắp xếp (Sort by Rating, Distance...) | BẢN ĐỒ TƯƠNG TÁC          |
| - Danh sách Place Cards (Ảnh, Tên, Sao, Khoảng cách, Tag...) | (VietMap / Leaflet)       |
| - Hover vào Card nào -> Marker trên bản đồ nhảy nổi bật     | - Các Pins/Markers địa điểm|
| - Phân trang (Pagination) hoặc Cuộn vô tận (Infinite Scroll)| - Click Marker -> Popup   |
+-------------------------------------------------------------+---------------------------+
```

> **Ghi chú Responsive cho Mobile**:
> Trên màn hình điện thoại di động, chuyển đổi linh hoạt giữa 2 chế độ xem: **Danh sách** và **Bản đồ** thông qua một nút nổi cố định ở góc dưới màn hình (*Floating Action Button - "Xem bản đồ 🗺️" / "Xem danh sách 📋"*).

---

## 2. Chi Tiết Các Khối Giao Diện & Tính Năng Cần Làm

### 🔍 KHỐI 1: THANH TÌM KIẾM THÔNG MINH (DUAL SEARCH BAR)
Đặt cố định ở phía trên cùng (Header/Hero area):

1. **Tab 1: Tìm kiếm theo Bộ lọc truyền thống (Keyword & Filter)**:
   - Input nhập từ khóa tìm kiếm (Tên quán, tên món ăn, địa chỉ...).
   - Dropdown chọn Vùng du lịch: Mặc định chọn **Đà Nẵng** (Gọi từ API `/travel-areas`).
2. **Tab 2: Tìm kiếm Bằng Trợ lý AI (Semantic AI Search — Điểm nhấn đồ án)**:
   - Input có biểu tượng ngôi sao lấp lánh (AI Sparkle ✨).
   - Placeholder: *"Nhập nhu cầu tự nhiên: 'quán cafe yên tĩnh làm việc gần biển', 'quán hải sản tươi ngon rẻ'..."*
   - Khi người dùng bấm Enter -> Frontend gọi endpoint `/places/semantic-search`.
   - Trên mỗi Card kết quả, hiển thị thêm Badge: **`Độ phù hợp AI: 85%`** (Lấy từ trường `similarityScore`).

---

### 🎛️ KHỐI 2: THANH BỘ LỌC DANH MỤC NHANH (QUICK CATEGORY TABS)
Thanh trượt ngang (Horizontal Scrollable Chips/Tabs) ngay dưới Search Bar:
- Tự động gọi API `GET /api/v1/places/categories` để hiển thị các danh mục kèm icon sinh động:
  - ☕ Cà phê (`ca-phe` - 930 địa điểm)
  - 🍜 Nhà hàng / Ẩm thực (`nha-hang` - 541 địa điểm)
  - 🏨 Khách sạn / Lưu trú (`khach-san` - 390 địa điểm)
  - 🍸 Bar & Pub (`bar-pub` - 90 địa điểm)
  - 🍢 Ăn vặt đường phố (`an-vat` - 68 địa điểm)
  - 🏛️ Điểm tham quan (`diem-tham-quan` - 37 địa điểm)
  - 🏖️ Bãi biển (`bai-bien`)
- Khi click chọn vào Chip nào -> Đổi màu active (Primary color) và trigger lọc dữ liệu ngay lập tức.

---

### ⚙️ KHỐI 3: BỘ LỌC CHI TIẾT & CÔNG CỤ SẮP XẾP (FILTER & SORT CONTROLS)
Nằm ở đầu cột danh sách bên trái:
1. **Nút "Tìm quanh đây" (Nearby GPS button)**:
   - Nút có Icon định vị 📍: Khi người dùng bấm vào -> Trình duyệt kích hoạt `navigator.geolocation.getCurrentPosition` xin tọa độ thực tế -> Gọi API `/places/nearby` với toạ độ hiện tại và bán kính tùy chọn (1km, 3km, 5km).
2. **Bộ lọc Nâng cao (Filter Modal/Popover)**:
   - Checkbox toggle: **`Chỉ hiện quán Đang mở cửa`** (`openNow=true`).
   - Mức giá (Budget level): `$` (Bình dân), `$$` (Vừa phải), `$$$` (Cao cấp).
   - Đánh giá tối thiểu: Dropdown chọn từ `⭐ 3.0+`, `⭐ 4.0+`, `⭐ 4.5+`.
3. **Dropdown Sắp xếp (Sort by)**:
   - Đánh giá cao nhất (`sortBy=RATING`, `sortOrder=DESC`).
   - Nhiều nhận xét nhất (`sortBy=REVIEW_COUNT`, `sortOrder=DESC`).
   - Gần vị trí nhất (`sortBy=DISTANCE`, `sortOrder=ASC`).

---

### 🎴 KHỐI 4: THẺ ĐỊA ĐIỂM (PLACE CARD COMPONENT)
Component hiển thị từng địa điểm trong danh sách (dạng Grid 2 cột hoặc List 1 cột):
- **Hình ảnh Thumbnail**:
  - Ảnh đại diện chính (`primaryImage`). Nếu `null` -> Hiển thị ảnh Placeholder đẹp mắt theo danh mục.
  - Nút Bookmark (Trái tim ❤️) ở góc trên ảnh để lưu vào danh sách yêu thích cá nhân.
- **Thông tin chi tiết**:
  - **Tên địa điểm**: In đậm, hiển thị nổi bật.
  - **Badge Danh mục**: Ví dụ: `[Cà phê]`, `[Nhà hàng]`.
  - **Rating & Reviews**: `⭐ 4.6 (128 đánh giá)`.
  - **Trạng thái Mở/Đóng cửa**: 
    - Chấm xanh lá: **Đang mở cửa** (kèm giờ mở/đóng).
    - Chấm đỏ: **Đã đóng cửa**.
  - **Địa chỉ**: Hiển thị số nhà, đường, quận (ví dụ: *Sơn Trà, Đà Nẵng*).
  - **Khoảng cách (nếu có)**: `Cách bạn: 450 m`.
- **Hiệu ứng tương tác liên kết Bản đồ (Micro-interactions)**:
  - Khi rê chuột (Hover) vào Place Card -> Thẻ hơi nổi lên nhẹ (`transform: translateY(-4px)`), đồng thời **Marker tương ứng trên Bản đồ bên phải sẽ đổi màu / phóng to / nảy lên (Bounce animation)**.
  - Khi Click vào Card -> Mở Modal chi tiết địa điểm.

---

### 🗺️ KHỐI 5: BẢN ĐỒ TƯƠNG TÁC (INTERACTIVE MAP)
Nằm cố định ở nửa màn hình bên phải:
- **Tâm bản đồ mặc định**: Đà Nẵng (`lat: 16.0544`, `lng: 108.2022`, zoom level: 13).
- **Custom Markers (Ghim trên bản đồ)**:
  - Hiển thị Marker sinh động kèm icon tròn theo danh mục (Icon ly cafe, dao nĩa, sóng biển...).
- **Popup khi click Marker**:
  - Hiển thị card thu nhỏ: Ảnh nhỏ, Tên địa điểm, Đánh giá sao và nút *"Xem chi tiết"*.
- **Tự động Fit Bounds**: Khi kết quả tìm kiếm thay đổi -> Bản đồ tự động zoom và căn chỉnh khung hình (Bounds) bao quát toàn bộ các địa điểm tìm thấy.

---

### 📄 KHỐI 6: POPUP / MODAL CHI TIẾT ĐỊA ĐIỂM (PLACE DETAIL MODAL)
Khi người dùng click vào 1 địa điểm, mở Modal chi tiết (gọi API `/places/:id`):
- **Gallery ảnh**: Hiển thị lưới nhiều ảnh thực tế (`place_images`).
- **Thông tin liên hệ**: Số điện thoại 📞 (nút bấm gọi nhanh), Website 🌐, Giờ mở cửa chi tiết 7 ngày trong tuần.
- **Nguồn dữ liệu & Nút hành động**:
  - Badge minh bạch: *Dữ liệu tổng hợp từ OpenStreetMap & Foursquare*.
  - Nút CTA nổi bật: **`+ Thêm vào lịch trình du lịch`** (Chuẩn bị kết nối sang Phase Lập lịch trình).

---

## 3. Danh Sách API Backend Sẵn Sàng Gọi Trực Tiếp

Toàn bộ các API dưới đây **đã được Backend xây dựng hoàn thiện 100%, test thực tế trên Database hơn 2,100 địa điểm Đà Nẵng**:

| Chức năng | Phương thức | URL Endpoint | Các tham số Query truyền lên |
|---|---|---|---|
| **1. Lọc đa tiêu chí** | `GET` | `/api/v1/places/search` | `keyword`, `areaId=1`, `categorySlugs` (vd: `ca-phe`), `openNow=true`, `minRating=4`, `sortBy=RATING`, `page=1`, `limit=20` |
| **2. Tìm kiếm quanh đây**| `GET` | `/api/v1/places/nearby` | `lat=16.054`, `lng=108.202`, `radiusMeters=3000`, `categorySlugs` |
| **3. Tìm kiếm bằng AI** | `GET` | `/api/v1/places/semantic-search` | `query=quán cafe yên tĩnh làm việc`, `areaId=1`, `limit=10` |
| **4. Danh sách Danh mục**| `GET` | `/api/v1/places/categories` | *(Không cần tham số - Trả về 15 categories kèm placeCount)* |
| **5. Danh sách Tỉnh/TP** | `GET` | `/api/v1/places/travel-areas` | *(Không cần tham số - Trả về Đà Nẵng, Hội An... kèm Bounding Box)* |
| **6. Chi tiết 1 địa điểm**| `GET` | `/api/v1/places/:id` | `id` (UUID của địa điểm truyền trên Path Param) |

---

## 4. Công Nghệ Khuyên Dùng Cho Frontend
- **UI Framework & Styling**: Next.js / React + TailwindCSS + `shadcn/ui` (Components: `Badge`, `Card`, `Dialog`, `Select`, `Slider`, `Skeleton` loading).
- **Thư viện Bản đồ**: VietMap GL JS (đã có trong dependencies) hoặc Leaflet.
- **Data Fetching & Cache**: TanStack Query (`@tanstack/react-query`) hoặc `swr` để tự động cache dữ liệu, hỗ trợ debounce ô tìm kiếm và hiển thị Skeleton Loading khi đang tải dữ liệu.
