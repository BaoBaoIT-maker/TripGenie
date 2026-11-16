# TripGenie — Design System & Visual Direction (DESIGN.md)

> **Identity**: Nền tảng Lập kế hoạch Du lịch Thông minh Việt Nam & Cộng tác Thời gian thực.  
> **Aesthetic Philosophy**: **Modern Travel Tech & Clean Editorial** — Diện mạo du lịch hiện đại, dứt khoát, thoáng đãng, mang hơi thở công nghệ cao kết hợp tinh hoa trải nghiệm bản địa (lấy cảm hứng từ Traveloka, Airbnb, Google Arts & Culture, Canva).  
> **Source of Truth for Visuals**: Tài liệu này quy định giao diện mục tiêu. `frontend/src/app/globals.css` là nơi triển khai token dùng chung; `frontend/src/app/layout.tsx` cấu hình font và icon Font Awesome CDN.
> **Governing Filter**: Kết hợp cùng `.agents/skills/antislop-ui/SKILL.md` để loại bỏ hoàn toàn "AI Slop".

---

## 1. Dials & Liveliness Settings (Tham số Antislop)

| Tham số | Giá trị | Ý nghĩa thực tế |
|---|---|---|
| **ENERGY** | `2` (Balanced) | Giao diện tươi sáng, tràn đầy năng lượng khám phá với sắc xanh **Electric Travel Sky Blue (`#0194F3`)**; tinh tế, sắc sảo, không dùng màu neon chói mắt. |
| **RHYTHM** | `2` (Harmonic) | Nhịp điệu bố cục đa dạng như trang chủ: Hero trực quan sắc nét $\to$ Horizontal Destination Track $\to$ Story Feature Blocks (Canva-style) $\to$ Asymmetric Mosaic Grid (Google Arts & Culture) $\to$ Collaborative Planning Mockup $\to$ Bản đồ tương tác. |
| **MOTION** | `1` (Subtle) | Chuyển động vi mô mượt mà (150ms–250ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`): Zoom ảnh nhẹ 1.025–1.05 khi hover, xoay nút đảo chiều 180 độ, popover nổi nhẹ. **Tuyệt đối không có chuyển động lặp vô tận (endless animation loops)**. Tôn trọng `prefers-reduced-motion`. |

---

## 2. Brand Identity & Visual Language (Phong cách Trang Chủ)

- **Nhận diện mới**: Lấy trang chủ hiện tại và logo la bàn, núi, mũi tên đi lên làm chuẩn. Dùng asset `frontend/public/images/logo_transparent.png` như `LandingNavbar`; giữ tỷ lệ, khoảng trống và màu gốc. Chọn nền giúp logo rõ, không nhuộm logo bằng CSS.
- **Tính cách thương hiệu**: Thông minh, dứt khoát, phóng khoáng, tin cậy, giàu chất bản địa.
- **Trải nghiệm cốt lõi**:
  - **Không rườm rà**: Toàn bộ tiêu đề chuyển sang sans-serif đậm nét, dứt khoát, hiện đại (Inter).
  - **Khoảng thở làm khung kết cấu (`whitespace as structure`)**: Sử dụng nền trắng sạch (`bg-white`) xen kẽ các dải Slate/Sky cao cấp (`bg-[#F5F9FF]`, `bg-[#F0F7FF]`, `bg-[#F8FAFC]`) tạo chiều sâu phân tầng rõ rệt.
  - **Hình ảnh chân thực**: Tôn vinh hình ảnh phong cảnh, ẩm thực và văn hóa thực tế với tỷ lệ chuẩn và hiệu ứng scrim chuyển màu tinh tế.
- **Nguyên tắc "The Litmus Test"**:
  > Giao diện TripGenie toát lên phong cách nền tảng du lịch thế hệ mới — chuẩn mực, sắc sảo, trực quan và tiện dụng, không bị nhầm lẫn với các dashboard quản lý khô khan.

---

## 3. Hệ màu xanh dương TripGenie

**Xanh dương là màu thương hiệu cho toàn bộ frontend.**
- **Màu nhận diện chủ đạo (Electric Travel Sky Blue — `#0194F3`)**: Sắc xanh sáng rực rỡ, tràn đầy năng lượng khám phá lấy từ logo và Trang chủ. Dùng cho: nút hành động chính (CTA button), viền thẻ đang chọn (active ring/border), dấu tích chọn, icon điểm nhấn, nút đảo chiều `⇄` và các huy hiệu du lịch.
- **Màu chữ chính (Deep Travel Navy — `#10243A`)**: Đậm đà, sắc sảo, độ tương phản cao trên nền sáng, mang lại cảm giác tin cậy và chuyên nghiệp.
- **Nền & Chiều sâu phân tầng**: Nền trang trắng ánh lam nhẹ (`#F5F9FF`), nền thẻ card trắng sạch (`#FFFFFF`), nền đảo thông tin khối (`#F8FAFC`), dải ngăn cách thanh lịch (`#F1F5F9`), viền bo (`#E2E8F0` hoặc `#D5E2F0`).
- **Khối thông tin chặng & Ghi chú**: Dùng nền xanh sữa sáng `bg-[#F0F7FF]` kết hợp viền `border-[#D0E7FF]`, chữ màu `text-slate-800 font-semibold` rõ nét. **Tuyệt đối không dùng chữ xám xịt, lợt lạt (`muted-foreground` bạc màu) gây mờ mắt khó đọc.**
- **Khối cảnh báo cự ly / an toàn**: Dùng nền hổ phách nhẹ `bg-amber-50/90`, viền `border-amber-200`, chữ nâu đậm `text-amber-950` kèm icon `fa-solid fa-triangle-exclamation text-amber-500`.

| Token | Light | Dark | Vai trò |
|---|---|---|---|
| `--brand-blue` | `#0194F3` | `#0194F3` | Màu nhận diện chính trên CTA, logo, viền active và chi tiết đồ họa |
| `--primary` | `#0194F3` | `#66BFFF` | Nút chính, liên kết nổi bật và mục đang chọn |
| `--primary-hover` | `#0084DE` | `#8ACFFF` | Nút chính khi hover |
| `--primary-foreground` | `#FFFFFF` | `#0B1728` | Chữ/icon trên nút chính |
| `--background` | `#F5F9FF` | `#0B1728` | Nền trang |
| `--foreground` | `#10243A` | `#EAF4FF` | Chữ chính |
| `--card`, `--popover` | `#FFFFFF` | `#12243C` | Card, menu, dropdown và dialog |
| `--secondary` | `#E8F4FD` | `#193552` | Nền tab được chọn, chip, badge và mục đang kích hoạt |
| `--secondary-foreground` | `#0194F3` | `#D6EBFF` | Chữ/icon trên nền secondary |
| `--accent` | `#D9EDFF` | `#234865` | Nền hover của menu và tương tác phụ |
| `--accent-foreground` | `#123E68` | `#EAF4FF` | Chữ trên nền accent |
| `--muted` | `#F1F5F9` | `#172B44` | Skeleton và dải ngăn cách phụ |
| `--muted-foreground` | `#64748B` | `#A9BDD5` | Mô tả và thông tin phụ |
| `--border` | `#E2E8F0` | `#304962` | Viền phân cách nhẹ |
| `--input` | `#CBD5E1` | `#6683A3` | Viền input cần nhận biết được |
| `--ring` | `#0194F3` | `#66BFFF` | Vòng focus bàn phím |

### Cách áp dụng

- Đặt giá trị màu đồng bộ; dùng màu xanh sáng `#0194F3` cho các điểm chạm tương tác chính để giao diện luôn tươi mới, dứt khoát, không bị xỉn màu hay tối tăm như các ứng dụng văn phòng cũ.
- Nút CTA chính với nền `#0194F3` dùng chữ trắng `text-white font-bold`, kèm shadow phát sáng nhẹ `shadow-[0_2px_8px_rgba(1,148,243,0.3)]`.
- Đỏ cho lỗi/hành động phá hủy, vàng hổ phách cho cảnh báo, xanh lá cho thành công. Các màu này mang ý nghĩa trạng thái, không thay màu thương hiệu. Rating, ghim danh mục và tuyến đường giữ khả năng phân biệt; luôn kèm icon, nhãn hoặc hình dạng khi màu mang thông tin.
- Giữ phong cách trang chủ: ảnh/video là điểm nhấn, nền sáng và chữ navy, nút xanh rõ. Ở các trang tác vụ, dùng nền đặc và viền nhẹ; chỉ dùng nền mờ trên thanh nổi hoặc ô tìm kiếm đặt trên hero khi chữ vẫn đọc được.

---

## 4. Typography System (Đồng bộ 100% với Trang Chủ)

Toàn bộ hệ thống giao diện chuẩn hóa sử dụng **Inter** cho cả Tiêu đề và Nội dung, tối ưu hoàn hảo cho tiếng Việt có dấu:

| Vai trò | Phông chữ | Class Tailwind | Ứng dụng thực tế |
|---|---|---|---|
| **Headings (Tiêu đề)** | **Inter** | `font-sans font-black tracking-tight` hoặc `font-extrabold tracking-tight` | Tiêu đề Hero, Tiêu đề Section, Tên vùng đất, Tiêu đề bài viết. Nét chữ đậm đà, hiện đại, uy lực và dễ đọc. |
| **Body (Nội dung)** | **Inter** | `font-sans font-medium text-slate-700` | Đoạn văn mô tả, thông số lịch trình, giờ mở cửa, ghi chú. |
| **Eyebrow / Badges** | **Inter** | `text-xs font-bold uppercase tracking-wider text-[#0194F3]` | Nhãn phân loại trên đầu section (`#0194F3`), thẻ danh mục. |
| **Monospace (Kỹ thuật)** | **Geist Mono** | `font-mono` | Tọa độ GPS, mã chuyến đi, mã đặt chỗ, số liệu chi phí. |

### Thang đo tỷ lệ (Type Scale) chuẩn Trang Chủ:
- `text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.12]`: Tiêu đề Hero chính.
- `text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight`: Tiêu đề Section (`h2`).
- `text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight`: Tiêu đề khối tính năng (`h3`).
- `text-base sm:text-lg font-bold text-slate-900 leading-snug`: Tên thẻ địa điểm (`PlaceCard`), tên bài viết cộng đồng (`PostCard`).
- `text-sm sm:text-base text-slate-700 font-medium leading-relaxed`: Văn bản nội dung và mô tả.
- `text-xs font-bold uppercase tracking-wider`: Nhãn danh mục, tag trạng thái.

---

## 5. Shape, Spacing & Elevation (Hình Khối & Chiều Sâu)

### 5.1 Bo góc (Border Radius Scale)
- **Thanh tìm kiếm, Badges & Floating Buttons**: `rounded-full` — Thân thiện, mượt mà, tạo cảm giác mời gọi tương tác.
- **Cards thông thường & Modals**: `rounded-2xl` (16px) — Bo tròn vừa vặn, chuẩn mực hiện đại.
- **Khối tính năng lớn & Story Blocks**: `rounded-3xl` (24px) — Tạo khung chứa vững chãi, ôm trọn nội dung.
- **Buttons & Input fields**: `rounded-xl` (12px) hoặc `rounded-full` tùy theo cấp bậc thị giác.

### 5.2 Shadows & Elevation (Độ nổi)
- **Thẻ thông thường khi đứng yên**: `border border-slate-200/80 shadow-2xs` hoặc `shadow-xs`.
- **Thẻ khi hover**: 
  - Ảnh zoom nhẹ 1.025–1.05 (`transition-transform duration-500 ease-out`).
  - Viền chuyển sang xanh nhẹ hoặc xám đậm hơn: `hover:border-slate-300` / `hover:border-[#0194F3]/40`.
  - Độ bóng nâng lên: `hover:shadow-lg` hoặc `hover:shadow-xl`. Thẻ giữ nguyên trục toạ độ, không rung lắc.
- **Floating Modals & Dropdowns**: `shadow-2xl border border-slate-200/90 backdrop-blur-md bg-white/95`.

---

## 6. Component Rules (Quy Chuẩn Thành Phần Giao Diện)

### 6.1 Section Headers
- Cấu trúc 3 tầng chuẩn trang chủ:
  1. **Eyebrow**: `text-xs font-bold uppercase tracking-wider text-[#0194F3]`.
  2. **Title (`h2`)**: `text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight`.
  3. **Description**: `text-slate-600 text-sm sm:text-base max-w-2xl leading-relaxed`.

### 6.2 Buttons & Interactions
- Primary Button: `bg-[#0194F3] hover:bg-[#0084DE] text-white font-bold rounded-xl shadow-[0_2px_8px_rgba(1,148,243,0.3)] transition-all active:scale-[0.98]`.
- Secondary / Outline Button: `border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#10243A] font-semibold rounded-xl shadow-2xs`.
- Đảm bảo **Functional Completeness (C-2)**: Mọi nút bấm hiển thị đều phải gắn liền với hành vi thật hoặc mở modal tương ứng.

### 6.3 Empty, Loading & Error States (Quy tắc 4 Trạng thái)
- **Loading State**: Sử dụng Skeleton UI tương đồng hình học với component thực tế; với spinner cục bộ dùng `fa-solid fa-circle-notch fa-spin text-[#0194F3]`.
- **Empty State**: Nêu rõ lý do trống và cung cấp đúng **1 nút hành động tích cực** để lấp đầy dữ liệu.
- **Error State**: Nêu rõ thông điệp và có nút `[Thử lại]`.

### 6.4 Mobile First & Safe Areas
- Nút bấm và vùng chạm cảm ứng (Touch Target): Tối thiểu **44×44px** trên thiết bị di động.

### 6.5 Dropdown, Combobox & Menu Items
- **Hover/Highlight State**:
  - Khi rê chuột (`hover`), dùng phím chọn (`focus`):
    - Nền: Bắt buộc dùng **xanh dương nhạt** (`bg-[#F0F7FF]`).
    - Chữ: Bắt buộc dùng **xanh dương thương hiệu** (`text-[#0194F3]`).
    - Icon đi kèm: Chuyển sang màu chữ của mục được chọn (`currentColor`).
- **User Avatar Dropdown (Navbar)**:
  - Tối giản: Chỉ bao gồm đúng **2 mục**: `Hồ sơ cá nhân` và `Đăng xuất`.

### 6.6 Search Bar & Travel Booking Inputs (Quy chuẩn Nhập liệu & Thanh tìm kiếm kiểu Traveloka)
- **Chống gạch chân đỏ kiểm tra chính tả trên tiếng Việt (Native Spellcheck Guard)**:
  - Bắt buộc gắn `spellCheck={false}`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"` trên mọi ô `<input type="text">` nhập địa điểm, tìm kiếm, tên thành phố, người dùng.
- **Thanh Hành Trình Hợp Nhất (Connected Journey Bar 50/50)**:
  - Chia đôi 50% - 50% cố định (`grid grid-cols-2 divide-x divide-[#F1F5F9]`).
  - Nút đảo chiều `⇄` neo chính giữa tuyệt đối bằng `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20`, hình tròn nổi `size-8 rounded-full bg-white border border-[#D0E7FF] text-[#0194F3] shadow-md hover:bg-[#F0F7FF]`, hiệu ứng xoay khi hover `group-hover:rotate-180`.
  - Padding bù trừ (`pr-6` cho ô trái, `pl-6` cho ô phải) để văn bản không bao giờ bị nút che khuất.
  - Kèm icon chỉ hướng khởi hành (`fa-solid fa-plane-departure text-[#0194F3]`) và điểm đến (`fa-solid fa-plane-arrival text-[#0194F3]`).
- **Thanh Lịch Trình Ngày Đi / Ngày Về (Date Range Bar)**:
  - Chia 50% - 50% cố định tương xứng với thanh hành trình.
  - Hiển thị ngày định dạng tiếng Việt tự nhiên (`Thứ 6, 20/11/2026`).
  - Đặt overlay `<input type="date">` phủ kín toàn bộ thẻ (`absolute inset-0 opacity-0 cursor-pointer w-full h-full`) để người dùng nhấp vào bất kỳ điểm nào trên thẻ đều mở bộ chọn ngày mượt mà.
- **Thẻ Phương Tiện Di Chuyển (Transit Vehicle Cards)**:
  - Tối giản: Chỉ hiển thị Icon Font Awesome + Tên phương tiện + Dấu tích chọn khi active.
  - Tuyệt đối không nhồi nhét dòng chữ thời gian rườm rà vào trong thẻ vé.
  - Toàn bộ thông tin cự ly, thời gian và trung chuyển hiển thị tập trung tại khối Lộ trình chi tiết phía dưới.
- **Khối Ghi Chú & Lộ Trình (Transit Notes & Breakdown)**:
  - Văn bản sắc nét, tương phản cao (`text-slate-800 font-semibold`, `text-slate-700 font-medium`, `text-xs`), tuyệt đối không dùng màu xám xịt nhạt nhòa (`muted-foreground` bạc màu).
  - Đặt trong khối bo góc nổi nhẹ (`bg-[#F0F7FF] border border-[#D0E7FF]`) với icon `<i class="fa-solid fa-circle-info text-[#0194F3]">`.
  - Khi cự ly vượt ngưỡng an toàn xe máy (> 300km), dùng khối cảnh báo hổ phách (`bg-amber-50 border-amber-200 text-amber-950` kèm icon `fa-solid fa-triangle-exclamation text-amber-500`).

---

## 7. Iconography & Anti-Slop Safeguards (Quy Chuẩn Icon & Chống Slop)

### 7.1 Thư viện Icon chuẩn toàn hệ thống: Font Awesome 6.5.2
Toàn bộ frontend sử dụng thư viện **Font Awesome 6.5.2** (`fa-solid`, `fa-regular`), được nạp qua CDN toàn cục tại `frontend/src/app/layout.tsx`.
- **Icon Phương tiện**:
  - Máy bay: `<i class="fa-solid fa-plane">`
  - Tàu hỏa: `<i class="fa-solid fa-train">`
  - Xe khách: `<i class="fa-solid fa-bus">`
  - Xe cá nhân: `<i class="fa-solid fa-car">`
  - Thuê xe máy: `<i class="fa-solid fa-motorcycle">`
  - Tàu thủy / Cao tốc biển: `<i class="fa-solid fa-ship">`
  - Chặng nối đa phương thức: `<i class="fa-solid fa-route">`
- **Icon Thao tác & Điều hướng**:
  - Đóng modal: `<i class="fa-solid fa-xmark">`
  - Đổi chiều hành trình: `<i class="fa-solid fa-arrow-right-arrow-left">`
  - Tích chọn thành công: `<i class="fa-solid fa-check">`
  - Lịch trình: `<i class="fa-regular fa-calendar">`, `<i class="fa-regular fa-calendar-check">`
  - Khởi hành: `<i class="fa-solid fa-plane-departure">`, Điểm đến: `<i class="fa-solid fa-plane-arrival">`
- **Icon Trạng thái & Chú thích**:
  - Loading / Chờ xử lý: `<i class="fa-solid fa-circle-notch fa-spin">`
  - Gợi ý / Lưu ý: `<i class="fa-solid fa-circle-info">`
  - Cảnh báo an toàn / Cự ly: `<i class="fa-solid fa-triangle-exclamation">`

### 7.2 Bộ lọc Chống AI-Slop (Anti-Slop Safeguards)
1. ❌ **Không dùng gradient AI tím-xanh rập khuôn**: Chỉ dùng các dải chuyển màu xanh nhạt hoặc slate sang trọng (`from-[#F0F7FF] via-[#F8FAFC] to-[#F1F5F9]`).
2. ❌ **Không emoji trang trí trong nút/tiêu đề**: Thay thế bằng icon Font Awesome dứt khoát mang ý nghĩa thực tế.
3. ❌ **Không icon trang trí vô nghĩa**:
   - Tuyệt đối không dùng icon đũa phép / tia sét lấp lánh (`fa-wand-magic-sparkles`, sparkles) tạo cảm giác chatbot rẻ tiền.
   - Không gắn icon la bàn trang trí trên tiêu đề khi không có chức năng định vị.
   - Mọi icon đều phải hỗ trợ việc đọc lướt (scannability) của người dùng.
4. ❌ **Không số liệu ảo (No fake stats/metrics)**: Mọi con số bài đăng, lượt nhân bản, đánh giá đều lấy từ cơ sở dữ liệu thật.
5. ❌ **Không endless pulse loops**: Không nhấp nháy đèn trạng thái vô tận gây phân tâm.
6. ❌ **Không bento grid hỗn loạn vô nghĩa**: Bố cục phải bám sát câu chuyện nội dung thực tế của du lịch.
