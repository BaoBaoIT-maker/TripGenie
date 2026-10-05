# PLAN FRONTEND
## Đề tài: Xây dựng hệ thống khám phá địa điểm du lịch và hỗ trợ lập kế hoạch trải nghiệm cá nhân

> Thời gian đề tài: 17/08/2026 - 27/12/2026  
> Trọng tâm tài liệu này: **Frontend với Next.js App Router + TypeScript**, ưu tiên làm được MVP hoàn chỉnh trước, sau đó mở rộng AI, cộng đồng và lập kế hoạch nhóm.

---

# 1. Mục tiêu Frontend

Frontend cần giải quyết được các luồng chính sau:

1. Người dùng đăng ký / đăng nhập.
2. Người dùng tìm kiếm và khám phá địa điểm.
3. Người dùng xem địa điểm trên bản đồ.
4. Người dùng xem chi tiết địa điểm.
5. Người dùng thêm địa điểm vào danh sách yêu thích / bộ sưu tập.
6. Người dùng tạo lịch trình cá nhân.
7. Người dùng kéo thả thay đổi thứ tự địa điểm trong lịch trình.
8. Người dùng xem lịch trình song song với bản đồ.
9. Người dùng nhập yêu cầu bằng ngôn ngữ tự nhiên để AI hỗ trợ tạo lịch trình.
10. Người dùng đăng bài chia sẻ trải nghiệm.
11. Người dùng đánh giá, bình luận, thích và lưu bài.
12. Người dùng chia sẻ / sao chép lịch trình của người khác.
13. Người dùng tạo nhóm/phòng và cùng thống nhất lịch trình.
14. Hệ thống có trang hồ sơ và thiết lập sở thích người dùng.

---

# 2. Tech Stack chốt

## 2.1 Core

- Next.js App Router
- TypeScript
- React

## 2.2 UI

- Tailwind CSS
- shadcn/ui
- Lucide React

## 2.3 Form & Validation

- React Hook Form
- Zod

## 2.4 Map / GIS

- VietMap GL JS
- Turf.js

## 2.5 State Management

- Zustand
- TanStack Query

## 2.6 Interaction

- @dnd-kit

## 2.7 Mock Backend

- MSW

## 2.8 Utility

- date-fns
- clsx
- tailwind-merge

---

# 3. Nguyên tắc kiến trúc

## 3.1 Tách Client State và Server State

### Zustand

Dùng cho:

- địa điểm đang được chọn;
- lịch trình đang chỉnh sửa;
- trạng thái UI tạm thời của bộ lọc (drawer đang mở, địa điểm hover/chọn);
- trạng thái map;
- wizard tạo lịch trình;
- giỏ địa điểm tạm thời.

### TanStack Query

Dùng cho:

- danh sách địa điểm;
- chi tiết địa điểm;
- bài đăng;
- review;
- comment;
- lịch trình đã lưu;
- profile;
- favorite;
- collection;
- group.

### URL Search Params

Dùng làm **source of truth** cho các bộ lọc có thể chia sẻ hoặc khôi phục khi reload:

```text
keyword
category
minRating
priceLevels
latitude
longitude
maxDistanceKm
openNow
tags
sort
page
```

Không lưu đồng thời cùng một giá trị filter trong cả URL và Zustand. Zustand chỉ giữ UI state tạm thời như `selectedPlaceId`, `hoveredPlaceId`, trạng thái drawer và map viewport.

---

## 3.2 Không gọi AI trực tiếp từ browser

Luồng đúng:

```text
Frontend
    ↓
NestJS API
    ↓
AI Service
    ↓
NestJS
    ↓
Frontend
```

Frontend chỉ gửi dữ liệu đầu vào, ví dụ:

```json
{
  "destination": "Đà Lạt",
  "duration": 3,
  "budget": 5000000,
  "people": 2,
  "preferences": ["cafe", "nature"],
  "prompt": "Muốn lịch trình chill, ít di chuyển"
}
```

---

## 3.3 Không phụ thuộc Backend trong giai đoạn đầu

Trong thời gian Backend chưa hoàn thành:

```text
UI
 ↓
service layer
 ↓
MSW
 ↓
mock JSON
```

Sau khi Backend hoàn thành:

```text
UI
 ↓
service layer
 ↓
NestJS API
 ↓
PostgreSQL
```

Mục tiêu: **không phải sửa lại component UI khi Backend có API thật**.

### Ranh giới MSW trong Next.js App Router

- `msw/browser` chỉ intercept các request phát sinh trong browser.
- Các feature dùng TanStack Query ở client đi qua `QueryClientProvider` và có thể gọi service được MSW browser intercept.
- Không giả định MSW browser sẽ intercept request chạy trong Server Component.
- Nếu cần mock request phía server hoặc trong test, dùng `msw/node` hoặc mock adapter tại service layer.
- Trong giai đoạn Frontend-only, chưa bắt buộc SSR prefetch bằng TanStack Query. Page/layout vẫn là Server Component; chỉ phần tương tác là Client Component.

---

## 3.4 Ranh giới Server Component và Client Component

```text
Page / Layout (Server Component mặc định)
    ├── nội dung tĩnh, metadata, SEO
    └── Feature Client Component
            ├── TanStack Query
            ├── Zustand
            ├── form tương tác
            ├── VietMap
            └── drag & drop
```

Không thêm `"use client"` vào toàn bộ page chỉ vì một component con cần browser API.

---

## 3.5 Mock session trong giai đoạn Frontend-only

Phase 2 phải có mock current user/session tối thiểu để Favorite, Review, Collection và Planner có thể hoạt động trước khi hoàn thiện UI Authentication.

```text
anonymous
authenticated mock user
```

Auth UI đầy đủ vẫn thuộc P1. Nếu chưa đăng nhập, planner draft có thể giữ tạm trong Zustand/local storage; thao tác cần tài khoản phải hiển thị yêu cầu đăng nhập.

---

# 4. Cấu trúc thư mục

```text
src/
│
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   │
│   ├── explore/
│   │   └── page.tsx
│   │
│   ├── places/
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   ├── planner/
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── edit/
│   │           └── page.tsx
│   │
│   ├── community/
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [postId]/
│   │       └── page.tsx
│   │
│   ├── collections/
│   │   └── page.tsx
│   │
│   ├── groups/
│   │   ├── page.tsx
│   │   └── [groupId]/
│   │       └── page.tsx
│   │
│   ├── profile/
│   │   └── page.tsx
│   │
│   ├── preferences/
│   │   └── page.tsx
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── common/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── SearchBox.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingState.tsx
│   │   └── ErrorState.tsx
│   │
│   ├── map/
│   │   ├── VietMap.tsx
│   │   ├── PlaceMarker.tsx
│   │   ├── RouteLayer.tsx
│   │   ├── MapPopup.tsx
│   │   └── MapControls.tsx
│   │
│   ├── place/
│   │   ├── PlaceCard.tsx
│   │   ├── PlaceGrid.tsx
│   │   ├── PlaceGallery.tsx
│   │   ├── PlaceInfo.tsx
│   │   ├── PlaceRating.tsx
│   │   └── ReviewList.tsx
│   │
│   ├── planner/
│   │   ├── PlannerWizard.tsx
│   │   ├── PlannerHeader.tsx
│   │   ├── DayTabs.tsx
│   │   ├── Timeline.tsx
│   │   ├── TimelineItem.tsx
│   │   ├── DraggableScheduleItem.tsx
│   │   ├── BudgetSummary.tsx
│   │   └── PlannerMap.tsx
│   │
│   ├── community/
│   │   ├── PostCard.tsx
│   │   ├── CreatePostForm.tsx
│   │   ├── CommentSection.tsx
│   │   └── PostActions.tsx
│   │
│   ├── collection/
│   │   ├── CollectionCard.tsx
│   │   └── CreateCollectionDialog.tsx
│   │
│   └── group/
│       ├── GroupCard.tsx
│       ├── GroupMemberList.tsx
│       └── GroupPlanner.tsx
│
├── features/
│   ├── auth/
│   ├── places/
│   ├── planner/
│   ├── community/
│   ├── collections/
│   └── groups/
│
├── hooks/
│   ├── useMap.ts
│   ├── useGeolocation.ts
│   ├── useDebounce.ts
│   └── usePlanner.ts
│
├── stores/
│   ├── planner-store.ts
│   ├── map-store.ts
│   └── search-store.ts
│
├── services/
│   ├── api-client.ts
│   ├── auth.service.ts
│   ├── place.service.ts
│   ├── planner.service.ts
│   ├── map.service.ts
│   ├── community.service.ts
│   ├── collection.service.ts
│   └── group.service.ts
│
├── schemas/
│   ├── auth.schema.ts
│   ├── planner.schema.ts
│   ├── review.schema.ts
│   └── post.schema.ts
│
├── types/
│   ├── user.ts
│   ├── place.ts
│   ├── planner.ts
│   ├── post.ts
│   ├── review.ts
│   └── group.ts
│
├── mocks/
│   ├── data/
│   ├── handlers/
│   └── browser.ts
│
├── lib/
│   ├── query-client.ts
│   ├── vietmap.ts
│   └── utils.ts
│
└── utils/
```

Quy ước trách nhiệm:

```text
components/ui/       shadcn/ui và UI primitive, không chứa business logic
components/common/   component dùng chung toàn app
components/map/      component VietMap dùng lại ở nhiều feature
features/<domain>/   component, hook, schema và logic riêng của từng domain
services/            API client và service dùng chung
stores/              client state thực sự dùng chéo nhiều feature
```

Không tạo đồng thời hai component cùng trách nhiệm trong `components/<domain>/` và `features/<domain>/`. Khi một component chỉ thuộc một domain, ưu tiên đặt trong `features/<domain>/`.

---

# 5. Các route Frontend

| Route | Chức năng |
|---|---|
| `/` | Trang chủ |
| `/login` | Đăng nhập |
| `/register` | Đăng ký |
| `/explore` | Khám phá địa điểm |
| `/places/[slug]` | Chi tiết địa điểm |
| `/planner` | Danh sách lịch trình |
| `/planner/new` | Tạo lịch trình |
| `/planner/[id]` | Xem lịch trình |
| `/planner/[id]/edit` | Chỉnh lịch trình |
| `/community` | Bảng tin |
| `/community/new` | Đăng bài |
| `/community/[postId]` | Chi tiết bài đăng |
| `/collections` | Yêu thích / bộ sưu tập |
| `/groups` | Danh sách nhóm |
| `/groups/[groupId]` | Phòng lập kế hoạch nhóm |
| `/profile` | Hồ sơ |
| `/preferences` | Sở thích |

---

# 6. Data Model Frontend tối thiểu

## 6.1 Place

```ts
export interface OpeningHour {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  openTime: string;  // HH:mm
  closeTime: string; // HH:mm
  isClosed?: boolean;
}

export interface Place {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  priceLevel: 1 | 2 | 3 | 4;
  images: string[];
  openingHours?: OpeningHour[];
  tags: string[];
}
```

---

## 6.2 Planner

```ts
export interface Planner {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: "VND";
  people: number;
  timezone: "Asia/Ho_Chi_Minh";
  status: "draft" | "saved";
  days: PlannerDay[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 6.3 Planner Day

```ts
export interface PlannerDay {
  day: number;
  date: string;
  items: PlannerItem[];
}
```

---

## 6.4 Planner Item

```ts
export interface PlannerItem {
  id: string;
  placeId: string;
  place: Place;
  startTime: string;
  durationMinutes: number;
  estimatedCost: number;
  travelDurationMinutes?: number;
  travelDistanceMeters?: number;
  note?: string;
  order: number;
}
```

---

## 6.5 Review

```ts
export interface Review {
  id: string;
  userId: string;
  placeId: string;
  rating: number;
  content: string;
  createdAt: string;
}
```

Rule:

```text
1 <= rating <= 5
```

Quy ước dữ liệu:

```text
date: YYYY-MM-DD
time: HH:mm
datetime: ISO 8601
currency: VND, số nguyên
distance: meter
duration: minute
tọa độ khi tạo GeoJSON: [longitude, latitude]
```

`PlannerItem.place` là dữ liệu đã hydrate để render UI; khi tạo/cập nhật planner, payload chỉ gửi `placeId` và các trường lịch trình cần thiết.

---

# 7. API Contract dùng cho Mock trước

## Auth

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /users/me
PATCH /users/me
PATCH /users/me/preferences
```

## Place

```text
GET /places
GET /places/:slug
GET /places/:id/reviews
POST /places/:id/reviews
```

Query mẫu:

```text
GET /places?keyword=cafe&category=coffee&minRating=4&priceLevels=2&latitude=11.94&longitude=108.44&maxDistanceKm=10&openNow=true&tags=chill&page=1&limit=12
```

Các query được hỗ trợ:

```text
keyword, category, minRating, priceLevels, latitude, longitude,
maxDistanceKm, openNow, tags, sort, page, limit
```

`latitude` và `longitude` là bắt buộc khi lọc theo `maxDistanceKm`.

## Planner

```text
GET    /planners
POST   /planners
GET    /planners/:id
PATCH  /planners/:id
DELETE /planners/:id

POST /planners/ai-generate
POST /planners/:id/copy
```

## Collection

```text
GET    /collections
POST   /collections
PATCH  /collections/:id
DELETE /collections/:id
POST   /collections/:id/places
DELETE /collections/:id/places/:placeId
```

## Favorite

```text
GET    /favorites
POST   /favorites/:placeId
DELETE /favorites/:placeId
```

## Community

```text
GET    /posts
POST   /posts
GET    /posts/:id
POST   /posts/:id/like
DELETE /posts/:id/like
GET    /posts/:id/comments
POST   /posts/:id/comments
POST   /posts/:id/bookmark
DELETE /posts/:id/bookmark
```

## Routing

```text
POST /routes
```

Request nhận danh sách tọa độ theo thứ tự planner; response trả route GeoJSON, tổng quãng đường, tổng thời gian và từng route leg.

## Recommendation

```text
GET /recommendations
```

## Group

```text
GET  /groups
POST /groups
GET  /groups/:id
POST /groups/:id/members
POST /groups/:id/place-suggestions
```

---

# 8. PHASE 0 — Chuẩn bị dự án

## Mục tiêu

Tạo skeleton project sạch trước khi bắt đầu UI.

## Công việc

- [ ] Tạo project Next.js App Router + TypeScript.
- [ ] Cài Tailwind.
- [ ] Cài shadcn/ui.
- [ ] Cài Lucide React.
- [ ] Cài Zustand.
- [ ] Cài TanStack Query.
- [ ] Cài React Hook Form.
- [ ] Cài Zod.
- [ ] Cài @dnd-kit.
- [ ] Cài MSW.
- [ ] Cài VietMap GL JS.
- [ ] Cài Turf.js.
- [ ] Cài date-fns.
- [ ] Tạo cấu trúc folder.
- [ ] Tạo `.env.local`.
- [ ] Tạo `providers.tsx` và cấu hình `QueryClientProvider`.
- [ ] Cấu hình MSW chỉ chạy trong development và được khởi tạo trước khi feature client gọi API.
- [ ] Tạo `.env.example`, không commit secret vào Git.
- [ ] Thiết lập ESLint / Prettier.
- [ ] Tạo Git repository.
- [ ] Tạo branch `develop`.

## Definition of Done

```text
npm run dev
```

chạy không lỗi.

```text
npm run build
```

build thành công.

---

# 9. PHASE 1 — Design System + Layout

## Mục tiêu

Tạo bộ giao diện dùng chung để tránh mỗi trang một kiểu.

## Component cần làm

Core cần có ngay:

- [ ] Button
- [ ] Input
- [ ] Badge
- [ ] Skeleton
- [ ] Rating Stars
- [ ] Navbar
- [ ] Footer

Cài và hoàn thiện theo phase sử dụng, không dựng trước toàn bộ khi chưa có use case:

- [ ] Select / Slider / Drawer — khi làm Explore.
- [ ] Dialog / Tabs — khi làm Planner, Collection.
- [ ] Dropdown / Avatar — khi làm Authentication, Profile.
- [ ] Toast — khi feature đầu tiên có mutation.

## Layout

Desktop:

```text
Navbar
────────────────────────
Content
────────────────────────
Footer
```

Mobile:

```text
Top Bar
Content
Bottom Navigation
```

## Definition of Done

- [ ] Responsive desktop.
- [ ] Responsive tablet.
- [ ] Responsive mobile.
- [ ] Navbar dùng chung toàn app.
- [ ] Typography thống nhất.
- [ ] Loading / error / empty state thống nhất.

---

# 10. PHASE 2 — Mock Data + MSW

## Mục tiêu

Frontend có API để làm việc mà không cần chờ Backend.

## Mock data

Tạo tối thiểu:

```text
30 places
5 users
20 reviews
10 posts
3 planners
5 collections
2 groups
```

## Địa điểm mẫu

Nên có nhiều category:

```text
Cafe
Restaurant
Sightseeing
Nature
Museum
Shopping
Entertainment
Hotel
```

## Công việc

- [ ] Viết `Place` type.
- [ ] Viết `Planner` type.
- [ ] Viết `User` type.
- [ ] Viết `Post` type.
- [ ] Viết mock JSON.
- [ ] Viết MSW handlers.
- [ ] Viết service layer.
- [ ] Kết nối TanStack Query.
- [ ] Tạo mock current user/session với trạng thái anonymous và authenticated.
- [ ] Tách `mocks/browser.ts` cho development và `mocks/server.ts` cho test.

## Definition of Done

Component gọi:

```ts
placeService.getPlaces()
```

và nhận dữ liệu qua MSW ở browser. Test có thể dùng `msw/node`; không phụ thuộc MSW browser cho request chạy phía server.

---

# 11. PHASE 3 — Trang chủ

## Mục tiêu

Người dùng hiểu ngay hệ thống dùng để làm gì.

## Các section

### Hero

```text
Khám phá địa điểm phù hợp với bạn
```

Search:

```text
Bạn muốn đi đâu?
```

### Category

- Ăn uống
- Cafe
- Du lịch
- Check-in
- Thiên nhiên
- Văn hóa
- Giải trí

### Recommended

```text
Có thể bạn sẽ thích
```

### Popular

```text
Địa điểm nổi bật
```

### Community

```text
Lịch trình đang được chia sẻ
```

Ở Phase 3 đây chỉ là section preview dùng planner/post mock và điều hướng. Không triển khai create post, like, comment, bookmark hoặc copy planner trước Phase 13.

## Definition of Done

- [ ] Search điều hướng sang `/explore`.
- [ ] Card địa điểm click được.
- [ ] Card bài đăng click được.
- [ ] Responsive.

---

# 12. PHASE 4 — Explore

## Mục tiêu

Cho phép tìm và lọc địa điểm.

## Layout Desktop

```text
Filters | Result List | Map
```

hoặc:

```text
Filters
─────────────────────
List            Map
```

## Filter

- [ ] Keyword
- [ ] Category
- [ ] Rating
- [ ] Price Level
- [ ] Distance
- [ ] Open Now
- [ ] Tags

## Interaction

```text
hover PlaceCard
      ↓
highlight marker
```

```text
click marker
      ↓
open popup
```

```text
click PlaceCard
      ↓
/places/[slug]
```

## Zustand

`search-store.ts`

```ts
selectedPlaceId
hoveredPlaceId
isFilterDrawerOpen
mapViewport
```

Các filter `keyword`, `category`, `minRating`, `priceLevels`, `latitude`, `longitude`, `maxDistanceKm`, `openNow`, `tags`, `sort`, `page` được đọc/ghi từ URL search params. URL là source of truth để reload, back/forward và chia sẻ link không làm mất filter.

## Definition of Done

- [ ] Filter hoạt động.
- [ ] Search hoạt động.
- [ ] URL có thể lưu query.
- [ ] List và map đồng bộ.

---

# 13. PHASE 5 — VietMap

## Mục tiêu

Render bản đồ và địa điểm thật sự trên map.

## Component

```text
VietMap
PlaceMarker
MapPopup
MapControls
```

## Lưu ý Next.js

Map phải là Client Component:

```tsx
"use client";
```

Không biến toàn bộ page thành Client Component nếu không cần.

VietMap GL JS phụ thuộc `window` / `document`. Component chứa map phải được import động từ một Client Component wrapper:

```tsx
import dynamic from "next/dynamic";

const VietMap = dynamic(() => import("@/components/map/VietMap"), {
  ssr: false,
});
```

Không dùng riêng `typeof window !== "undefined"` như giải pháp chính nếu server và client có thể render markup khác nhau, vì vẫn có nguy cơ hydration mismatch.

## Feature

- [ ] Render map.
- [ ] Zoom.
- [ ] Pan.
- [ ] Marker.
- [ ] Popup.
- [ ] Fit bounds.
- [ ] Current location.
- [ ] Selected marker.
- [ ] GeoJSON layer.

## Definition of Done

Map nhận:

```ts
places: Place[]
```

và hiển thị được toàn bộ marker.

`RouteLayer` và route polyline thật thuộc Phase 10 — Routing. Phase này chỉ chịu trách nhiệm map nền, marker, popup, controls và map/list synchronization.

## VietMap API Key

- Không hardcode key trong source code hoặc commit key vào Git.
- Key bắt buộc dùng bởi SDK trên browser phải đặt trong biến môi trường public và cấu hình domain whitelist/restriction trên VietMap.
- Secret dùng cho Routing API có tính phí không được đưa vào biến `NEXT_PUBLIC_*`; request phải đi qua Next.js Route Handler như `/api/vietmap/route` hoặc backend proxy.
- Route Handler không thể che giấu một public map token mà SDK browser bắt buộc phải nhận; domain restriction vẫn là lớp bảo vệ chính cho loại key này.

---

# 14. PHASE 6 — Place Detail

## Mục tiêu

Người dùng xem đầy đủ thông tin một địa điểm.

## UI

```text
Gallery
────────────────────────
Tên địa điểm
Rating
Category
Address
Price
Opening Hours
Description
Map
Reviews
```

## Action

- [ ] Favorite
- [ ] Add to Collection
- [ ] Add to Planner
- [ ] Write Review
- [ ] Share

## Review Form

```text
Rating: 1 → 5
Content
Submit
```

Validation:

```text
rating >= 1
rating <= 5
content != empty
```

## Definition of Done

- [ ] Load place bằng slug.
- [ ] Gallery hoạt động.
- [ ] Review hiển thị.
- [ ] Rating hiển thị.
- [ ] Add to Planner hoạt động.

---

# 15. PHASE 7 — Planner Wizard

## Mục tiêu

Cho người dùng tạo chuyến đi mà không cần AI trước.

## Wizard

### Step 1

```text
Bạn muốn đi đâu?
```

### Step 2

```text
Ngày bắt đầu
Ngày kết thúc
```

### Step 3

```text
Số người
```

### Step 4

```text
Ngân sách
```

### Step 5

```text
Sở thích
```

### Step 6

```text
Chọn địa điểm
```

## Zustand

`planner-store.ts`

```ts
destination
startDate
endDate
people
budget
preferences
selectedPlaces
days
```

## Definition of Done

Người dùng đi hết wizard:

```text
Step 1
 ↓
Step 2
 ↓
...
 ↓
Create Planner
```

và điều hướng tới:

```text
/planner/[id]
```

---

# 16. PHASE 8 — Planner Split View

## Mục tiêu

Đây là **màn hình showcase chính của dự án**.

## Layout

```text
┌──────────────────────────────────────────────────┐
│ Planner Header                                   │
├────────────────────────┬─────────────────────────┤
│                        │                         │
│ Timeline               │ VietMap                 │
│                        │                         │
│ Day 1                  │   ● Place A             │
│ 08:00 Place A          │    ╲                    │
│                        │     ● Place B            │
│ 10:00 Place B          │      ╲                  │
│                        │       ● Place C          │
│ 14:00 Place C          │                         │
│                        │                         │
├────────────────────────┴─────────────────────────┤
│ Distance | Cost | Duration                       │
└──────────────────────────────────────────────────┘
```

## Timeline Item

Hiển thị:

```text
Time
Place
Duration
Cost
Travel time
Note
```

## Definition of Done

- [ ] Timeline render.
- [ ] Map render.
- [ ] Marker theo planner.
- [ ] Đường nối tạm giữa các marker hoặc empty route state trước Phase 10.
- [ ] Tổng chi phí.
- [ ] Vị trí hiển thị tổng khoảng cách/thời gian; dữ liệu route thật hoàn thiện ở Phase 10.
- [ ] Từng ngày riêng biệt.

---

# 17. PHASE 9 — Drag & Drop

## Mục tiêu

Cho người dùng thay đổi thứ tự trải nghiệm.

Sử dụng:

```text
@dnd-kit
```

## Flow

```text
Place A
Place B
Place C
```

kéo:

```text
Place C
   ↓
Place A
```

kết quả:

```text
Place C
Place A
Place B
```

Sau đó:

```text
update order
    ↓
update UI và planner local state ngay
    ↓
debounce 500ms - 800ms sau onDragEnd
    ↓
recalculate route
    ↓
update polyline khi request mới nhất thành công
```

Không gọi Routing API trong `onDragMove` hoặc sau mỗi thay đổi vị trí con trỏ. Chỉ gọi sau `onDragEnd`, có debounce và hủy/bỏ qua response cũ khi có request mới để tránh race condition.

## Mobile Touch Sensor

```ts
useSensor(TouchSensor, {
  activationConstraint: {
    delay: 250,
    tolerance: 5,
  },
});
```

Ưu tiên drag handle riêng để giảm xung đột với scroll. Vẫn phải hỗ trợ thao tác thay đổi thứ tự bằng bàn phím thông qua `KeyboardSensor`.

## Definition of Done

- [ ] Drag hoạt động desktop.
- [ ] Drag hoạt động mobile.
- [ ] Zustand cập nhật order.
- [ ] Map cập nhật theo thứ tự mới.
- [ ] Không gọi routing trong `onDragMove`.
- [ ] Route chỉ tính lại sau debounce 500ms - 800ms.
- [ ] Touch scroll không bị khóa khi người dùng chưa nhấn giữ đủ thời gian.

---

# 18. PHASE 10 — Routing

## Mục tiêu

Hiển thị đường đi thực tế giữa các địa điểm.

## Không dùng Turf.js để thay Routing API

Turf:

```text
distance
bbox
point
lineString
spatial calculation
```

Routing API:

```text
actual road route
travel distance
travel duration
```

## Luồng

```text
Planner items
     ↓
coordinates
     ↓
Routing API
     ↓
GeoJSON
     ↓
RouteLayer
```

Trong giai đoạn Frontend-only:

```text
plannerService / routeService
    ↓
POST /routes hoặc /api/vietmap/route
    ↓
MSW handler
    ↓
mock Route GeoJSON + distance + duration + legs
```

Khi thay bằng VietMap Routing thật, component không đổi contract. UI phải giữ route cũ trong lúc refetch, hiển thị trạng thái đang cập nhật và có fallback khi routing lỗi.

## Definition of Done

Route:

```text
A → B → C → D
```

được hiển thị trên VietMap.

- [ ] Chỉ response của request mới nhất được phép cập nhật route.
- [ ] Có loading, error và retry cho routing.
- [ ] Secret routing key không xuất hiện trong client bundle.

---

# 19. PHASE 11 — AI Planner UI

## Mục tiêu

Cho người dùng nhập yêu cầu bằng ngôn ngữ tự nhiên.

## UI

```text
Lên lịch trình cho tôi...
```

Ví dụ:

```text
Lên lịch trình Đà Lạt 3N2Đ cho 2 người,
ngân sách 5 triệu,
thích cafe chill và thiên nhiên.
```

Quick Chip:

```text
[Couple]
[Family]
[Friends]
[Solo]

[Cafe]
[Nature]
[Food]
[Check-in]

[2N1Đ]
[3N2Đ]
[4N3Đ]
```

## Request

```text
POST /planners/ai-generate
```

## Loading

```text
AI đang phân tích yêu cầu...
```

## Result

```text
Generated Planner
     ↓
Preview
     ↓
Edit
     ↓
Save
```

## Definition of Done

Frontend xử lý đủ:

```text
idle
loading
success
error
```

---

# 20. PHASE 12 — Favorite + Collection

## Mục tiêu

Người dùng lưu địa điểm muốn trải nghiệm.

## UI

```text
My Collections
```

Ví dụ:

```text
❤️ Favorites

☕ Cafe muốn thử

💑 Hẹn hò

👨‍👩‍👧 Gia đình

📷 Check-in
```

## Feature

- [ ] Create Collection.
- [ ] Rename Collection.
- [ ] Delete Collection.
- [ ] Add Place.
- [ ] Remove Place.

---

# 21. PHASE 13 — Community

## Mục tiêu

Tạo bảng tin chia sẻ trải nghiệm.

## Feed

PostCard:

```text
Avatar + User
Location
Images
Content
Planner
Like
Comment
Bookmark
```

## Feature

- [ ] Create Post.
- [ ] View Post.
- [ ] Like.
- [ ] Comment.
- [ ] Bookmark.
- [ ] Share.
- [ ] Copy Planner.

## Copy Planner

```text
Community Post
      ↓
View shared planner
      ↓
Copy Planner
      ↓
My Planner
```

Đây là feature nên demo vì thể hiện sự kết nối giữa:

```text
Community
+
Planner
```

---

# 22. PHASE 14 — Group Planner

## Mục tiêu

Cho nhiều người cùng lập kế hoạch.

## Flow

```text
Create Group
     ↓
Invite Member
     ↓
Suggest Place
     ↓
Vote
     ↓
Add to Planner
```

## UI

```text
Group Name

Members
────────────

Suggested Places
────────────
Place A  👍 5
Place B  👍 3

Group Planner
────────────
```

## MVP Group

Không cần realtime ngay.

Có thể mock:

```text
suggest
vote
accept
```

trước.

---

# 23. PHASE 15 — Profile + Preferences

## Profile

- [ ] Avatar.
- [ ] Full name.
- [ ] Bio.
- [ ] Saved planners.
- [ ] Posts.
- [ ] Collections.

## Preferences

### Food

```text
Vietnamese
Japanese
Korean
Western
Vegetarian
```

### Travel

```text
Nature
Culture
Food
Cafe
Photography
Shopping
```

### Budget

```text
Low
Medium
High
Luxury
```

### Travel Style

```text
Relax
Balanced
Packed
```

Mục đích:

```text
Preferences
    ↓
Personalized Recommendation
```

---

# 24. PHASE 16 — Recommendation

## Mục tiêu

Frontend hiển thị được gợi ý cá nhân hóa.

## Section

```text
Dành cho bạn
```

Card có thể hiển thị:

```text
92% phù hợp với bạn
```

Reason:

```text
Vì bạn thích Cafe và địa điểm yên tĩnh
```

Frontend không cần tự tính recommendation.

Backend trả:

```json
{
  "place": {},
  "score": 0.92,
  "reasons": [
    "Bạn thường xem địa điểm cafe",
    "Phù hợp ngân sách của bạn"
  ]
}
```

---

# 25. PHASE 17 — Responsive

Đây là phase **regression responsive toàn hệ thống**, không phải thời điểm đầu tiên làm responsive. Mỗi phase trước đó phải kiểm tra giao diện ở các breakpoint liên quan ngay khi hoàn thành.

Kiểm tra:

```text
375px
768px
1024px
1440px
```

## Planner Mobile

Desktop:

```text
Timeline | Map
```

Mobile:

```text
Tabs

[Timeline] [Map]
```

hoặc:

```text
Timeline
────────
Map Drawer
```

---

# 26. PHASE 18 — Error Handling

Đây là phase **audit error handling toàn hệ thống**. Loading, Success, Empty và Error vẫn là Definition of Done bắt buộc của từng feature gọi API ngay từ lúc feature được triển khai.

Mọi page gọi API phải có:

```text
Loading
Success
Empty
Error
```

Ví dụ:

```text
Explore

Loading:
Skeleton Card

Empty:
Không tìm thấy địa điểm phù hợp.

Error:
Không thể tải địa điểm.
[Thử lại]
```

---

# 27. PHASE 19 — Performance

## Image

Dùng:

```text
next/image
```

## Page

Không đặt `"use client"` ở page nếu không cần.

## Dynamic import

VietMap GL JS bắt buộc được load bằng dynamic import với `ssr: false` bên trong Client Component wrapper. Các browser-only module nặng khác dùng dynamic import khi có lợi cho bundle và thời gian tải trang.

## TanStack Query

Cấu hình:

```text
staleTime
retry
refetchOnWindowFocus
```

hợp lý.

## List

Nếu dữ liệu nhiều:

```text
pagination
hoặc
infinite scroll
```

---

# 28. PHASE 20 — SEO

SEO quan trọng cho:

```text
Place Detail
Community Post
Shared Planner
```

## Metadata

Ví dụ:

```text
title:
Top địa điểm cafe đẹp tại Đà Lạt

description:
Khám phá các quán cafe...
```

## Dynamic Metadata

Dùng:

```ts
generateMetadata()
```

cho:

```text
/places/[slug]
/community/[postId]
```

---

# 29. PHASE 21 — Testing

Testing được viết cùng từng feature; Phase 21 là regression và E2E toàn bộ flow demo.

## Automated Test tối thiểu

```text
Vitest:
- Zod schema
- Zustand action
- filter/parser utility
- planner cost/duration calculation

React Testing Library:
- form validation
- loading/error/empty state
- filter interaction

Playwright:
- Explore → Place Detail
- Add to Planner
- Drag & Drop → Route update
- AI Generate → Preview → Save
```

## Manual Test

Kiểm tra các flow:

### Flow 1

```text
Home
→ Explore
→ Place
→ Favorite
```

### Flow 2

```text
Home
→ Place
→ Add Planner
→ Planner
```

### Flow 3

```text
Planner
→ Drag Drop
→ Route update
```

### Flow 4

```text
AI Prompt
→ Generate
→ Edit
→ Save
```

### Flow 5

```text
Community
→ Shared Planner
→ Copy
```

---

# 30. PHASE 22 — Kết nối Backend thật

Khi NestJS hoàn thành:

## Bước 1

Đổi:

```text
NEXT_PUBLIC_API_URL
```

từ mock/local sang API thật.

## Bước 2

Tắt MSW production.

## Bước 3

Test:

```text
auth
places
planner
community
collection
group
```

## Bước 4

Kiểm tra error response.

Ví dụ:

```json
{
  "statusCode": 400,
  "message": "Invalid request"
}
```

Frontend cần map message phù hợp.

---

# 31. Thứ tự ưu tiên Feature

## P0 — Bắt buộc

```text
Home
Explore
Map
Place Detail
Planner
Drag & Drop
Routing
Mock Session Foundation
```

## P1 — Nên có

```text
AI Planner
Authentication
Favorite
Collection
Profile
Preference
```

## P2 — Mở rộng

```text
Community
Review
Comment
Share Planner
Copy Planner
```

## P3 — Nếu còn thời gian

```text
Group Planner
Voting
Advanced Recommendation
Realtime Collaboration
```

---

# 32. MVP đầu tiên

Không làm toàn bộ project cùng lúc.

MVP đầu tiên chỉ cần:

```text
Home
  ↓
Explore
  ↓
Place Detail
  ↓
Add to Planner
  ↓
Planner
  ↓
Drag & Drop
  ↓
VietMap Route
```

Mục tiêu:

> Một người dùng có thể tìm một địa điểm và xây dựng một lịch trình trực quan trên bản đồ.

Nếu flow này hoàn thành, project đã có phần lõi để demo.

---

# 33. Roadmap theo tuần

> Có thể điều chỉnh tùy tiến độ Backend và lịch học.

## Tuần 1 — 17/08 → 23/08

```text
Setup
Design System
Folder Structure
Types
Mock Data
```

Kết quả:

```text
Project skeleton
```

---

## Tuần 2 — 24/08 → 30/08

```text
Home
Navbar
Footer
PlaceCard
Category
```

Kết quả:

```text
Homepage hoàn chỉnh
```

---

## Tuần 3 — 31/08 → 06/09

```text
Explore
Search
Filters
TanStack Query
```

Kết quả:

```text
Search địa điểm bằng mock API
```

---

## Tuần 4 — 07/09 → 13/09

```text
VietMap
Marker
Popup
Map/List Sync
```

Kết quả:

```text
Explore Map hoàn chỉnh
```

---

## Tuần 5 — 14/09 → 20/09

```text
Place Detail
Gallery
Review
Favorite
```

Kết quả:

```text
Place Detail hoàn chỉnh
```

---

## Tuần 6 — 21/09 → 27/09

```text
Planner Wizard
Planner Store
Create Planner
```

Kết quả:

```text
Tạo được planner
```

---

## Tuần 7 — 28/09 → 04/10

```text
Planner Timeline
Split View
Map
```

Kết quả:

```text
Planner UI hoàn chỉnh
```

---

## Tuần 8 — 05/10 → 11/10

```text
dnd-kit
Reorder
Planner interaction
```

Kết quả:

```text
Drag & Drop hoạt động
```

---

## Tuần 9 — 12/10 → 18/10

```text
Routing
Polyline
Distance
Duration
```

Kết quả:

```text
Planner Map hoàn chỉnh
```

---

## Tuần 10 — 19/10 → 25/10

```text
AI Planner UI
Prompt
Quick Chips
Loading
Preview
```

Kết quả:

```text
AI Planner Frontend hoàn chỉnh
```

---

## Tuần 11 — 26/10 → 01/11

```text
Authentication
Profile
Preferences
```

Kết quả:

```text
User module hoàn chỉnh
```

---

## Tuần 12 — 02/11 → 08/11

```text
Favorite
Collections
```

Kết quả:

```text
Collection module hoàn chỉnh
```

---

## Tuần 13 — 09/11 → 15/11

```text
Community
Post
Like
Comment
```

Kết quả:

```text
Community feed
```

---

## Tuần 14 — 16/11 → 22/11

```text
Share Planner
Copy Planner
```

Kết quả:

```text
Community ↔ Planner integration
```

---

## Tuần 15 — 23/11 → 29/11

```text
Group
Invite
Suggestion
Vote
```

Kết quả:

```text
Group Planner MVP
```

---

## Tuần 16 — 30/11 → 06/12

```text
Connect Backend
Replace Mock
API Integration
```

Kết quả:

```text
Frontend + NestJS
```

Tuần 16 là đợt hoàn tất migration, không phải lần đầu kiểm tra contract. Từ Phase 2, service và MSW handler phải dùng cùng request/response type; endpoint backend nào sẵn sàng thì tích hợp và kiểm tra theo từng module.

---

## Tuần 17 — 07/12 → 13/12

```text
Responsive
Testing
Fix Bug
```

---

## Tuần 18 — 14/12 → 20/12

```text
SEO
Performance
Polish UI
Demo Data
```

---

## Tuần cuối — 21/12 → 27/12

```text
Final Test
Deploy
Prepare Demo
Prepare Screenshots
Prepare Report
```

---

# 34. Checklist demo cuối kỳ

Trước khi demo phải test:

- [ ] Login.
- [ ] Register.
- [ ] Search place.
- [ ] Filter.
- [ ] Open map.
- [ ] Click marker.
- [ ] Open place detail.
- [ ] Favorite.
- [ ] Add to planner.
- [ ] Create planner.
- [ ] Drag planner item.
- [ ] Route update.
- [ ] AI generate planner.
- [ ] Save planner.
- [ ] Create post.
- [ ] Comment.
- [ ] Like.
- [ ] Copy shared planner.
- [ ] Open collection.
- [ ] Open profile.
- [ ] Mobile responsive.

---

# 35. Flow demo đề xuất

Đây là flow nên dùng khi bảo vệ:

```text
1. Trang chủ
      ↓
2. Search "Đà Lạt"
      ↓
3. Explore
      ↓
4. Filter "Cafe"
      ↓
5. Click marker
      ↓
6. Place Detail
      ↓
7. Add to Planner
      ↓
8. AI Generate 3N2Đ
      ↓
9. Planner Split View
      ↓
10. Drag & Drop
      ↓
11. Route Update
      ↓
12. Save
      ↓
13. Share Community
      ↓
14. User khác Copy Planner
```

Flow này thể hiện gần như toàn bộ giá trị chính của hệ thống:

```text
Discovery
+
Map
+
Personalization
+
AI
+
Planner
+
Community
```

---

# 36. Quy tắc làm project

## Quy tắc 1

Không code UI trực tiếp với mock JSON.

Luôn đi qua:

```text
service layer
```

## Quy tắc 2

Không gọi API trong component bằng fetch rải rác.

Dùng:

```text
service
+
TanStack Query
```

## Quy tắc 3

Không đưa tất cả state vào Zustand.

Server data để TanStack Query quản lý.

## Quy tắc 4

Không đặt toàn bộ app là Client Component.

## Quy tắc 5

Hoàn thành MVP trước khi làm Community / Group.

## Quy tắc 6

Mỗi feature phải có:

```text
loading
error
empty
success
```

## Quy tắc 7

Mỗi phase xong phải commit Git.

Ví dụ:

```text
feat(explore): implement place filters

feat(map): integrate VietMap markers

feat(planner): add drag and drop schedule

feat(ai): implement planner prompt interface
```

## Quy tắc 8

Mỗi feature hoàn thành phải kiểm tra ngay:

```text
responsive ở breakpoint liên quan
keyboard accessibility
loading / success / empty / error
lint
typecheck
test liên quan
build
```

Không dồn responsive, error handling và testing đến các phase cuối.

## Quy tắc 9

Không hardcode hoặc commit API key. Public map token phải có domain restriction; secret routing key phải đi qua Route Handler/backend proxy.

---

# 37. Mốc quan trọng

## Milestone 1

```text
Home + Explore + Map
```

## Milestone 2

```text
Place + Planner
```

## Milestone 3

```text
Drag & Drop + Routing
```

## Milestone 4

```text
AI Planner
```

## Milestone 5

```text
Community + Collection
```

## Milestone 6

```text
Backend Integration
```

## Milestone 7

```text
Final Demo
```

---

# 38. Kết luận

Thứ tự quan trọng nhất:

```text
Setup
 ↓
Home
 ↓
Explore
 ↓
Map
 ↓
Place
 ↓
Planner
 ↓
Drag & Drop
 ↓
Routing
 ↓
AI
 ↓
Favorite / Collection
 ↓
Community
 ↓
Group
 ↓
Backend Integration
 ↓
Testing
 ↓
Deploy
```

Không nên bắt đầu bằng AI hoặc Community.

**Phần lõi cần hoàn thành trước là:**

```text
Explore
+
Place
+
Map
+
Planner
```

Sau khi bốn phần này ổn định, các chức năng AI, cá nhân hóa, cộng đồng và lập kế hoạch nhóm sẽ được xây dựng trên nền tảng đó.
