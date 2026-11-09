# TripGenie — Design System & Visual Direction (DESIGN.md)

> **Identity**: Nền tảng Lập kế hoạch Du lịch Thông minh Việt Nam & Cộng tác Thời gian thực.  
> **Aesthetic Philosophy**: **Modern Travel Tech & Clean Editorial** — Diện mạo du lịch hiện đại, dứt khoát, thoáng đãng, mang hơi thở công nghệ cao kết hợp tinh hoa trải nghiệm bản địa (lấy cảm hứng từ Traveloka, Airbnb, Google Arts & Culture, Canva).  
> **Source of Truth for Visuals**: Tài liệu này quy định giao diện mục tiêu. `frontend/src/app/globals.css` là nơi triển khai token dùng chung; `frontend/src/app/layout.tsx` cấu hình font. Khi chuyển giao diện sang bộ màu mới, đổi token tập trung trước, sau đó cập nhật từng trang.
> **Governing Filter**: Kết hợp cùng `.agents/skills/antislop-ui/SKILL.md` để loại bỏ hoàn toàn "AI Slop".

---

## 1. Dials & Liveliness Settings (Tham số Antislop)

| Tham số | Giá trị | Ý nghĩa thực tế |
|---|---|---|
| **ENERGY** | `2` (Balanced) | Giao diện tươi sáng, tràn đầy năng lượng khám phá với sắc xanh **Electric Travel Sky Blue (`#0194F3`)**; tinh tế, sắc sảo, không dùng màu neon chói mắt. |
| **RHYTHM** | `2` (Harmonic) | Nhịp điệu bố cục đa dạng như trang chủ: Hero trực quan sắc nét $\to$ Horizontal Destination Track $\to$ Story Feature Blocks (Canva-style) $\to$ Asymmetric Mosaic Grid (Google Arts & Culture) $\to$ Collaborative Planning Mockup $\to$ Bản đồ tương tác. |
| **MOTION** | `1` (Subtle) | Chuyển động vi mô mượt mà (150ms–250ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`): Zoom ảnh nhẹ 1.025–1.05 khi hover, trượt thanh cuộn điểm đến, popover nổi nhẹ. **Tuyệt đối không có chuyển động lặp vô tận (endless animation loops)**. Tôn trọng `prefers-reduced-motion`. |

---

## 2. Brand Identity & Visual Language (Phong cách Trang Chủ)

- **Nhận diện mới**: Lấy trang chủ hiện tại và logo la bàn, núi, mũi tên đi lên làm chuẩn. Dùng asset `frontend/public/images/logo_transparent.png` như `LandingNavbar`; giữ tỷ lệ, khoảng trống và màu gốc. Chọn nền giúp logo rõ, không nhuộm logo bằng CSS.
- **Tính cách thương hiệu**: Thông minh, dứt khoát, phóng khoáng, tin cậy, giàu chất bản địa.
- **Trải nghiệm cốt lõi**:
  - **Không rườm rà**: Loại bỏ phong cách phông chữ có chân (Serif/Playfair Display) cổ điển cũ; toàn bộ tiêu đề chuyển sang sans-serif đậm nét, dứt khoát, hiện đại.
  - **Khoảng thở làm khung kết cấu (`whitespace as structure`)**: Sử dụng nền trắng sạch (`bg-white`) xen kẽ các dải Slate cao cấp (`bg-slate-50`, `bg-[#F0F7FF]`, `bg-[#F8FAFC]`) tạo chiều sâu phân tầng rõ rệt.
  - **Hình ảnh chân thực**: Tôn vinh hình ảnh phong cảnh, ẩm thực và văn hóa thực tế với tỷ lệ chuẩn và hiệu ứng scrim chuyển màu tinh tế.
- **Nguyên tắc "The Litmus Test"**:
  > Giao diện TripGenie toát lên phong cách nền tảng du lịch thế hệ mới — chuẩn mực, sắc sảo, trực quan và tiện dụng, không bị nhầm lẫn với các dashboard quản lý khô khan.

---

## 3. Hệ màu xanh dương TripGenie

**Xanh dương là màu thương hiệu cho toàn bộ frontend.** Xanh sáng `#0194F3` lấy từ màu nhấn của trang chủ, phù hợp với logo mới. Nền trắng ánh lam, các mảng xanh nhạt và chữ navy để ảnh du lịch nổi bật. Dùng xanh đậm cho hành động chính; không dùng teal hoặc coral làm màu thương hiệu ở trang mới.

| Token | Light | Dark | Vai trò |
|---|---|---|---|
| `--brand-blue` | `#0194F3` | `#0194F3` | Màu nhận diện trên logo và chi tiết đồ họa |
| `--primary` | `#0068B8` | `#66BFFF` | Nút chính, liên kết và mục đang chọn |
| `--primary-hover` | `#00569C` | `#8ACFFF` | Nút chính khi hover |
| `--primary-foreground` | `#FFFFFF` | `#0B1728` | Chữ/icon trên nút chính |
| `--background` | `#F5F9FF` | `#0B1728` | Nền trang |
| `--foreground` | `#10243A` | `#EAF4FF` | Chữ chính |
| `--card`, `--popover` | `#FFFFFF` | `#12243C` | Card, menu, dropdown và dialog |
| `--secondary` | `#E6F2FF` | `#193552` | Nền tab được chọn, chip và mục chưa đọc |
| `--secondary-foreground` | `#174A79` | `#D6EBFF` | Chữ trên nền secondary |
| `--accent` | `#D9EDFF` | `#234865` | Nền hover của menu và tương tác phụ |
| `--accent-foreground` | `#123E68` | `#EAF4FF` | Chữ trên nền accent |
| `--muted` | `#EDF3FA` | `#172B44` | Skeleton và vùng phụ |
| `--muted-foreground` | `#475569` | `#A9BDD5` | Mô tả và thông tin phụ |
| `--border` | `#D5E2F0` | `#304962` | Viền phân cách nhẹ |
| `--input` | `#7489A1` | `#6683A3` | Viền input cần nhận biết được |
| `--ring` | `#0068B8` | `#66BFFF` | Vòng focus bàn phím |

### Cách áp dụng

- Đặt giá trị màu ở `globals.css`; dùng token theo vai trò như `bg-primary`, `text-primary-foreground`, `bg-secondary`, `border-border`, `ring-ring`. Không rải mã hex, OKLCH hoặc class `blue-*` theo từng component. `--card-foreground`/`--popover-foreground` dùng `--foreground`; sidebar theo token tương ứng của theme.
- `#0194F3` với chữ trắng chỉ khoảng **3.22:1**; dùng `--primary` cho CTA có chữ trắng ở light mode (khoảng **5.72:1**). Dark mode dùng chữ navy trên nút xanh sáng. Kiểm tra màu chữ nhỏ tối thiểu **4.5:1**, focus và ranh giới điều khiển cần thiết tối thiểu **3:1** trên nền liền kề. Kiểm tra riêng phần chữ đặt trên ảnh/video và các màu có opacity.
- Đỏ cho lỗi/hành động phá hủy, vàng hổ phách cho cảnh báo, xanh lá cho thành công. Các màu này mang ý nghĩa trạng thái, không thay màu thương hiệu. Rating, ghim danh mục và tuyến đường giữ khả năng phân biệt; luôn kèm icon, nhãn hoặc hình dạng khi màu mang thông tin.
- Giữ phong cách trang chủ: ảnh/video là điểm nhấn, nền sáng và chữ navy, nút xanh rõ. Ở các trang tác vụ, dùng nền đặc và viền nhẹ; chỉ dùng nền mờ trên thanh nổi hoặc ô tìm kiếm đặt trên hero khi chữ vẫn đọc được.

### Áp dụng khi thiết kế lại các trang

Trang chủ `/` là mẫu nhận diện đã chốt và giữ nguyên trong đợt chuyển màu. Áp dụng bộ màu cho các trang còn lại; kiểm tra token và component dùng chung không làm đổi Trang chủ gián tiếp.

1. Đổi token light/dark cho trang chức năng và rà component dùng chung: Navbar/mobile menu, Footer, Button, Input, Dialog, Tabs, Card.
2. Áp dụng theo luồng: Đăng nhập/Hồ sơ → Khám phá/Bản đồ/Chi tiết địa điểm → Lịch trình/Bạn đồng hành → Cộng đồng/Bộ sưu tập/Thông báo/Chat. Chuông dùng chấm xanh cho chưa đọc, bảng bạn đồng hành dùng CTA xanh và nền nhẹ.
3. Với mỗi trang, kiểm tra desktop/mobile và light/dark, các trạng thái hover/focus/disabled/loading/empty/error. Thay các màu teal cũ dùng cho thương hiệu bằng token, giữ màu trạng thái đúng nghĩa. Không thay đổi nghiệp vụ chỉ để đổi giao diện.

---

## 4. Typography System (Đồng bộ 100% với Trang Chủ)

Toàn bộ hệ thống giao diện chuẩn hóa sử dụng **Inter** cho cả Tiêu đề và Nội dung, tối ưu hoàn hảo cho tiếng Việt có dấu:

| Vai trò | Phông chữ | Class Tailwind | Ứng dụng thực tế |
|---|---|---|---|
| **Headings (Tiêu đề)** | **Inter** | `font-sans font-black tracking-tight` hoặc `font-extrabold tracking-tight` | Tiêu đề Hero, Tiêu đề Section, Tên vùng đất, Tiêu đề bài viết. Nét chữ đậm đà, hiện đại, uy lực và dễ đọc. |
| **Body (Nội dung)** | **Inter** | `font-sans font-medium text-slate-600` | Đoạn văn mô tả, thông số lịch trình, giờ mở cửa, ghi chú. |
| **Eyebrow / Badges** | **Inter** | `text-xs font-bold uppercase tracking-wider` | Nhãn phân loại trên đầu section (`#0194F3`), thẻ danh mục. |
| **Monospace (Kỹ thuật)** | **Geist Mono** | `font-mono` | Tọa độ GPS, mã chuyến đi, mã đặt chỗ, số liệu chi phí. |

### Thang đo tỷ lệ (Type Scale) chuẩn Trang Chủ:
- `text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.12]`: Tiêu đề Hero chính.
- `text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight`: Tiêu đề Section (`h2`).
- `text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight`: Tiêu đề khối tính năng (`h3`).
- `text-base sm:text-lg font-bold text-slate-900 leading-snug`: Tên thẻ địa điểm (`PlaceCard`), tên bài viết cộng đồng (`PostCard`).
- `text-sm sm:text-base text-slate-600 font-medium leading-relaxed`: Văn bản nội dung và mô tả.
- `text-xs font-bold uppercase tracking-wider`: Nhãn danh mục, tag trạng thái.

---

## 5. Shape, Spacing & Elevation (Hình Khối & Chiều Sâu)

### 5.1 Bo góc (Border Radius Scale)
- **Thanh tìm kiếm & Badges**: `rounded-full` — Thân thiện, mượt mà, tạo cảm giác mời gọi tương tác.
- **Cards thông thường & Modals**: `rounded-2xl` (16px) — Bo tròn vừa vặn, chuẩn mực hiện đại.
- **Khối tính năng lớn & Story Blocks**: `rounded-3xl` (24px) — Tạo khung chứa vững chãi, ôm trọn nội dung.
- **Buttons & Input fields**: `rounded-xl` (12px) hoặc `rounded-full` tùy theo cấp bậc thị giác.

### 5.2 Shadows & Elevation (Độ nổi)
- **Thẻ thông thường khi đứng yên**: `border border-slate-200/80 shadow-xs` hoặc `shadow-sm`.
- **Thẻ khi hover**: 
  - Ảnh zoom nhẹ 1.025–1.05 (`transition-transform duration-500 ease-out`).
  - Viền chuyển sang xanh nhẹ hoặc xám đậm hơn: `hover:border-slate-300` / `hover:border-[#0194F3]/40`.
  - Độ bóng nâng lên: `hover:shadow-xl` hoặc `hover:shadow-2xl`. Thẻ giữ nguyên trục toạ độ, không rung lắc.
- **Floating Modals & Dropdowns**: `shadow-2xl border border-slate-200/90 backdrop-blur-md bg-white/95`.

---

## 6. Component Rules (Quy Chuẩn Thành Phần Giao Diện)

### 6.1 Section Headers
- Cấu trúc 3 tầng chuẩn trang chủ:
  1. **Eyebrow**: `text-xs font-bold uppercase tracking-wider text-primary`.
  2. **Title (`h2`)**: `text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight`.
  3. **Description**: `text-slate-600 text-sm sm:text-base max-w-2xl leading-relaxed`.

**Place Cards (`PlaceCard`)**
- **Tỷ lệ ảnh**: Aspect ratio `16:9` hoặc `4:3`, sử dụng `next/image` với `object-cover`.
- **Bookmark**: Nằm ở góc trên bên phải ảnh, vùng bấm tối thiểu 44×44px trên mobile. Khi đã lưu, dùng icon tô màu `primary` và nhãn truy cập phù hợp; không chỉ dựa vào màu để phân biệt.
- **Rating**: Hiển thị sao vàng rõ nét kèm số lượng đánh giá thật dạng `4.8 (124 đánh giá)`.

### 6.2 Buttons & Interactions
- Primary Button: `bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl shadow-xs transition-colors active:scale-[0.98]`.
- Secondary / Outline Button: `border border-border bg-card hover:bg-secondary text-foreground font-semibold rounded-xl shadow-xs`.
- Đảm bảo **Functional Completeness (C-2)**: Mọi nút bấm hiển thị đều phải gắn liền với hành vi thật hoặc mở modal tương ứng.

### 6.3 Empty, Loading & Error States (Quy tắc 4 Trạng thái)
- **Loading State**: Sử dụng Skeleton UI tương đồng hình học với component thực tế, không dùng spinner trơ trọi.
- **Empty State**: Nêu rõ lý do trống và cung cấp đúng **1 nút hành động tích cực** để lấp đầy dữ liệu.
- **Error State**: Nêu rõ thông điệp và có nút `[Thử lại]`.

### 6.4 Mobile First & Safe Areas
- Header, `MobileNavSheet` và các nút nổi: chừa vùng an toàn cho tai thỏ và thanh điều hướng hệ thống. Không mặc định chừa chỗ cho BottomNav cũ đã bỏ.
- Nút bấm và vùng chạm cảm ứng (Touch Target): Tối thiểu **44×44px** trên thiết bị di động.

### 6.5 Dropdown, Combobox & Menu Items (Quy tắc Menu & Dropdown)
- **Hover/Highlight State**:
  - Khi rê chuột (`hover`), dùng phím chọn (`focus`), hoặc ở trạng thái `data-[highlighted]`:
    - Nền: Bắt buộc dùng **xanh dương nhạt** (token `--accent`).
    - Chữ: Bắt buộc dùng **xanh dương thương hiệu** (token `--accent-foreground`).
    - Icon đi kèm: Bắt buộc chuyển sang màu chữ của mục được chọn (`currentColor`).
  - ❌ **Cấm kỵ**: Tuyệt đối không để rớt về màu nâu, cam đất hoặc coral từ token cũ (`--accent-foreground: oklch(0.42 0.14 45)`). Khi thêm dropdown/menu item, luôn kiểm tra để đảm bảo hover không bị ám màu lạ.
- **User Avatar Dropdown (Navbar)**:
  - Tối giản, thanh lịch: Chỉ bao gồm đúng **2 mục**:
    1. `Hồ sơ cá nhân` (icon `User`).
    2. `Đăng xuất` (icon `LogOut`).
  - Không thêm header tên tài khoản/email thừa trừ khi có yêu cầu cụ thể.
  - Nút `Đăng xuất` dùng màu chữ và icon trung tính tiêu chuẩn như các mục khác (không tô màu đỏ gay gắt; khi hover dùng chung nền xanh nhạt và chữ xanh thương hiệu).
  - Kích thước: `w-44`, padding `p-1`, bo góc `rounded-xl`, đổ bóng `shadow-lg border border-slate-200/90`.

---

## 7. Anti-Slop Safeguards (Bộ Lọc Chống Slop)

1. ❌ **Không dùng gradient AI tím-xanh rập khuôn**: Chỉ dùng các dải chuyển màu xanh nhạt hoặc slate sang trọng (`from-[#F0F7FF] via-[#F8FAFC] to-[#F1F5F9]`).
2. ❌ **Không emoji trang trí trong nút/tiêu đề**: Dùng icon SVG dứt khoát từ Lucide.
3. ❌ **Không số liệu ảo (No fake stats/metrics)**: Mọi con số bài đăng, lượt nhân bản, đánh giá đều lấy từ cơ sở dữ liệu thật.
4. ❌ **Không endless pulse loops**: Không nhấp nháy đèn trạng thái vô tận gây phân tâm.
5. ❌ **Không bento grid hỗn loạn vô nghĩa**: Bố cục phải bám sát câu chuyện nội dung thực tế của du lịch.
