# TripGenie — Project Context (Living Document)

> **Đây là file bộ nhớ dự án. Mọi quyết định thiết kế, quy chuẩn code, quy trình test, trạng thái hiện tại và bước tiếp theo đều được ghi ở đây.**
> Khi bắt đầu một phiên làm việc mới, hãy đọc file này trước tiên.

---

## 1. Tổng quan

**TripGenie** — Nền tảng Lập kế hoạch Du lịch Thông minh & Cộng tác Thời gian thực.

**Mục tiêu**: Đồ án tốt nghiệp. Ưu tiên demo được, architecture rõ ràng, không cần production-scale ngay.

---

## 2. Tech Stack (Đã quyết định)

| Layer | Technology | Lý do |
|-------|-----------|-------|
| Backend | NestJS + TypeScript | Module system, DI container, decorator-based |
| ORM | Prisma 7 | Type-safe ORM; raw SQL cho PostGIS/pgvector |
| Database | PostgreSQL 17 + PostGIS 3.5 + pgvector 0.8.6 | Spatial + vector search |
| Cache/Queue | Redis 7 + BullMQ | Session, cache, background jobs |
| AI | Gemini 2.5 Flash | LLM + Embedding |
| Routing | OpenRouteService | TSP/route matrix |
| Real-time | Socket.IO (NestJS Gateway) | WebSocket cho group voting + presence |
| Auth | JWT + Google/Facebook OAuth2 | Stateless, social login, HttpOnly cookies |

---

## 3. Quy chuẩn Commit & Git Workflow (Conventional Commits)

Tất cả commit & push lên GitHub **BẮT BUỘC** tuân thủ chuẩn **Conventional Commits**:

Format: `<type>(<scope>): <short description>`

### Các `type` quy định:
- `feat`: Tính năng mới (ví dụ: `feat(auth): add HttpOnly cookie support and OAuth2 strategies`)
- `fix`: Sửa lỗi (ví dụ: `fix(prisma): strip UTF-8 BOM from schema file`)
- `docs`: Cập nhật tài liệu (ví dụ: `docs(schema): update DB.md v5 and Project-context.md`)
- `refactor`: Tái cấu trúc code (ví dụ: `refactor(auth): move auth module to src/modules/auth`)
- `test`: Thêm/sửa unit test, E2E test (ví dụ: `test(auth): add unit tests for auth service and controller`)
- `chore`: Cấu hình build, dependencies, docker, gitignore (ví dụ: `chore(docker): add postgres dockerfile with pgvector`)

---

## 4. Quy chuẩn Kiến trúc & SOLID (Senior Backend Standard)

Mỗi module nghiệp vụ (ví dụ: `auth`, `users`, `places`, `itineraries`) **BẮT BUỘC** tuân thủ cấu trúc 6 tầng chuẩn Clean Architecture & SOLID:

```
src/modules/<module-name>/
├── dto/              ← DTOs validate request body/query/params (class-validator)
├── interfaces/       ← Domain Contracts, Repository Interfaces, Response Shapes
├── <name>.repository.ts ← Data Access Layer bọc PrismaService (Dependency Inversion)
├── <name>.service.ts    ← Pure Business Logic (Single Responsibility)
├── <name>.controller.ts ← HTTP Routing, Guards, Status Codes, HttpOnly Cookies
├── <name>.service.spec.ts ← Unit tests cho Service
├── <name>.controller.spec.ts ← Unit tests cho Controller
└── <name>.module.ts     ← Module registration, Exports & Injection Tokens
```

### Quy định Token Security:
- **HttpOnly Cookies**: Server trả về `accessToken` & `refreshToken` dưới dạng `HttpOnly` Cookies (`sameSite: 'lax'`, `secure: production`).
- **Dual Extractor**: `JwtStrategy` hỗ trợ giải nén JWT từ cả `HttpOnly Cookie` (`req.cookies.accessToken`) và `Authorization: Bearer <token>` Header.
- **Logout Endpoint**: `POST /api/v1/auth/logout` xóa sạch HttpOnly Cookies trên Browser.

---

## 5. Quy trình Testing Bắt buộc cho Mỗi Module (Mandatory Testing Workflow)

Khi hoàn thành bất kỳ module nào, **BẮT BUỘC** thực hiện quy trình 4 bước kiểm thử sau:

1. **Viết Unit Tests (`*.service.spec.ts`, `*.controller.spec.ts`)**:
   - Mock 100% dependencies (Repositories, External Services, JwtService, Redis).
   - Test tất cả trường hợp Thành công (Happy Path) và Thất bại.
2. **Viết Integration / E2E Tests (`test/*.e2e-spec.ts`)**:
   - Sử dụng `Supertest` giả lập client gửi HTTP Request thật đến NestJS App.
3. **Chạy Test Suite & Build Verification**:
   - Chạy `npm run test` (Unit Tests) ➔ Phải 100% PASS.
   - Chạy `npm run build` ➔ Phải 0 lỗi TypeScript.
4. **Cập nhật Progress Tracker**:
   - Chỉ đánh dấu `[x]` hoàn thành module trên `Project-context.md` sau khi toàn bộ Test Suite và Build thành công.

---

## 6. Database Schema (v5 — Source of Truth: `docs/backend/database.md`)

- **29 bảng**, **15 enums**, **5 triggers**, **1 view** (`active_places`), **6 extensions** (`uuid-ossp`, `postgis`, `vector`, `pg_trgm`, `citext`, `unaccent`).
- **Prisma Schema**: `backend/prisma/schema.prisma` khớp 100% với `docs/backend/database.md` v5.

---

## 7. Progress Tracker

### DONE — PHASE 1: Foundation Setup

- [x] **ARCHITECTURE.md** — 27 sections hoàn chỉnh
- [x] **DB.md v5** — 29 bảng, 15 enums, 5 triggers, views, design notes
- [x] **tsconfig.json** — Bật strict mode
- [x] **docker-compose.yml & Dockerfile** — PostgreSQL 17 (PostGIS+pgvector) + Redis 7
- [x] **init.sql** — Nạp tự động 6 extensions, 29 bảng, 5 triggers, 1 view `active_places`
- [x] **.env & .env.example** — Nạp đầy đủ các biến Gemini 2.5, OAuth, Gmail SMTP
- [x] **Prisma 7 Schema** — `npx prisma generate` thành công
- [x] **Core Infrastructure** — ExceptionsFilter, ResponseInterceptor, LoggingInterceptor, Guards, Decorators

### DONE — PHASE 2: Auth Module & Redis Token Blacklist

- [x] **DTOs** — `RegisterDto`, `LoginDto`, `VerifyOtpDto`, `RefreshTokenDto`
- [x] **UsersRepository & IUsersRepository** — Interface DI token `USER_REPOSITORY`
- [x] **MailService** — Gửi mail OTP 6 số qua Gmail SMTP với `nodemailer`
- [x] **AuthService** — bcrypt hash, Redis OTP (10 min TTL), JWT issue (1d/7d) với `jti` UUID
- [x] **RedisModule** — `@Global()` Redis provider (`REDIS_CLIENT`) dùng chung toàn ứng dụng
- [x] **TokenBlacklistService** — Quản lý thu hồi JWT khi logout qua Redis `jti` (`blacklist:token:<jti>`), tự xóa khi token hết hạn TTL, hỗ trợ fail-open
- [x] **Passport Strategies** — `JwtStrategy` (dual cookie/header extractor, tự động check Redis blacklist), `GoogleStrategy`, `FacebookStrategy`
- [x] **HttpOnly Cookie Support & Logout** — Auto set `accessToken` & `refreshToken` cookies, `POST /auth/logout` blacklist `jti` từ `@CurrentUser()` & clear cookies (no double-decode)
- [x] **AuthController** — Endpoints: `/auth/register`, `/auth/verify-otp`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/google`, `/auth/facebook`, `/auth/me`
- [x] **Unit Tests** — `auth.service.spec.ts`, `auth.controller.spec.ts`, `token-blacklist.service.spec.ts` ➔ **100% PASS (35/35 tests total)**
- [x] **E2E Tests** — `test/auth.e2e-spec.ts` ➔ **100% PASS**

### DONE — PHASE 3: Data Crawler & Place Data Enrichment Pipeline

- [x] **Database Seed** — `prisma/seed.sql`: 15 categories + 12 travel areas (Tier 1 & Tier 2) kèm tọa độ Bounding Box GPS
- [x] **Centralized Enums & Utils** — `crawler.enum.ts` (`CrawlProviderName`, `CrawlJobType`, `CrawlJobStatus`, `DataCoverageStatus`, `PlaceStatus`, `OsmCategorySlug`), `string.util.ts` (`normalizeVietnamese`)
- [x] **SOLID Contracts** — `ICrawlerProvider`, `ICrawlerRepository`, `IIngestionService`, `IEnrichmentProvider` (Strategy Pattern)
- [x] **CrawlerRepository** — Prisma-based data access layer với raw PostGIS spatial queries (`ST_DWithin`), bổ sung `updatePlace`, `getUnenrichedPlacesByArea`
- [x] **OsmProvider Upgrade** — Tích hợp Overpass API với ConfigService (URL, 30s timeout), trích xuất trực tiếp `phone`, `website`, `opening_hours`, `wikidata`, `image` tags từ OSM
- [x] **FoursquareProvider** — Tích hợp Foursquare Places API v3 với `FOURSQUARE_API_KEY`, làm giàu Rating (0-10 -> 0-5), `reviewCount`, `budgetLevel` Enum (`LOW`, `MEDIUM`, `HIGH`, `LUXURY`), Hours, Phone, Website, Photos
- [x] **WikimediaProvider** — Tích hợp Wikipedia REST API (Free 100%, no key), kéo ảnh nét cao & bài thuyết minh tiếng Việt từ `wikidata` ID hoặc tên địa điểm du lịch
- [x] **PlaceEnrichmentService** — Cấu trúc Chain of Responsibility tiêm mảng `ENRICHMENT_PROVIDERS[]` (Plug-and-Play), tự động lưu mảng ảnh vào bảng `place_images` và cập nhật `imageCount`, trích xuất `wikidata` ID từ `place_sources`
- [x] **TriggerEnrichmentDto** — Validate `areaId` (@IsInt, @Min(1)) và `limit` (@IsOptional, @Min(1), @Max(100))
- [x] **DeduplicationService** — Chống cào lặp 2 tầng (Exact `provider+externalId` lookup + Spatial `ST_DWithin(50m)` & lexical similarity)
- [x] **OsmIngestionService** — Implementation của `IIngestionService`, xử lý vòng lặp cào dữ liệu, ghi log tiến độ mỗi 50 items, tăng `errorCount`, upsert `data_coverage`
- [x] **CrawlJobService** — Quản lý tạo job & trigger cào ngầm phụ thuộc `IIngestionService` abstraction qua `INJECT_TOKENS.OSM_INGESTION_SERVICE`
- [x] **CrawlerController** — Endpoints: `POST /crawler/trigger` (HTTP 202 Accepted), `POST /crawler/enrich` (Kích hoạt enrich theo khu vực), `GET /crawler/jobs/:id`
- [x] **CrawlerModule** — Đăng ký DI tokens `CRAWLER_REPOSITORY`, `OSM_PROVIDER`, `ENRICHMENT_PROVIDERS` (mảng Plug & Play), `OSM_INGESTION_SERVICE`
- [x] **Unit Tests** — 12 Test Suites (43/43 tests PASS 100%): `deduplication.service.spec.ts`, `osm-ingestion.service.spec.ts`, `foursquare.provider.spec.ts`, `wikimedia.provider.spec.ts`, `place-enrichment.service.spec.ts`, `crawler.controller.spec.ts`
- [x] **BullMQ Queue Workers** — Tích hợp `CrawlProcessor` (`@Processor('crawl-queue')`) & `EnrichProcessor` (`@Processor('enrich-queue')`), hỗ trợ **Auto-Retry 5 lần với Exponential Backoff (5s, 10s, 20s...)** khi rớt mạng/sập kết nối, đẩy job qua Redis Queue độc lập.
- [x] **Thực thi Cào Thực Tế (Đà Nẵng)** — Cào thành công **2,124 địa điểm thực tế** tại Đà Nẵng (Bbox: 15.97-16.16, 107.98-108.36), phân loại vào 11 danh mục (930 Cafe, 541 Nhà hàng, 390 Khách sạn, 90 Bar/Pub, 68 Ăn vặt, 37 Điểm tham quan...), bóc tách giờ mở cửa (302), phone (247), website (126).

### DONE — PHASE 4: Places & Search Engine Module

- [x] **PlacesRepository** — Triển khai `IPlaceRepository` với PostGIS spatial indexing (`ST_DWithin`, `ST_Distance(..., true)`), Dynamic SQL Parameterized Builder an toàn chống SQL injection.
- [x] **PlacesService** — Nghiệp vụ lọc đa tiêu chí theo Form Frontend (keyword, areaId, categorySlugs, budgetLevels, minRating, openNow, pagination, sorting), DTO mapping, và tính toán giờ mở cửa (`checkIsOpenNow`).
- [x] **PlacesController** — Cung cấp 5 endpoints RESTful công khai:
  - `GET /api/v1/places/search`: Tìm kiếm & lọc đa tiêu chí theo Form bộ lọc Frontend.
  - `GET /api/v1/places/nearby`: Tìm kiếm địa điểm xung quanh vị trí GPS bằng PostGIS spatial radius.
  - `GET /api/v1/places/categories`: Danh sách 15 categories kèm số lượng địa điểm thực tế (`placeCount`).
  - `GET /api/v1/places/travel-areas`: Danh sách 12 travel areas kèm bounding box GPS.
  - `GET /api/v1/places/:id`: Chi tiết 1 địa điểm (UUID) kèm mảng hình ảnh gallery và nguồn dữ liệu.
- [x] **Semantic Vector Search (AI Natural Language)**:
  - **Google Gemini Embedding 2**: Tích hợp `models/gemini-embedding-2` cấu hình chuẩn `outputDimensionality: 1536` khớp hoàn hảo với cột `VECTOR(1536)` trong PostgreSQL.
  - **HNSW Index Optimization**: Tạo chỉ mục HNSW (`idx_place_embeddings_hnsw` với `vector_cosine_ops`) trên bảng `place_embeddings`, đảm bảo tốc độ tìm kiếm khoảng cách Cosine $O(\log N)$ cực nhanh.
  - **SOLID Abstraction**: Thiết kế `IEmbeddingService` & `GeminiEmbeddingService` tuân thủ Dependency Inversion, đăng ký qua token `INJECT_TOKENS.EMBEDDING_SERVICE`.
  - **Endpoints**:
    - `GET /api/v1/places/semantic-search`: Tìm kiếm ngữ nghĩa tự nhiên thông minh, tính điểm tương đồng Cosine $\text{similarityScore} = 1 - (\text{embedding} \Leftrightarrow \text{query\_vector})$.
    - `POST /api/v1/places/sync-embeddings`: Tác vụ nền đồng bộ nhúng vector cho các địa điểm chưa có embedding.
  - **Kiểm thử thực tế (Real Tests)**: Test trực tiếp các câu query tự nhiên tiếng Việt trên dữ liệu thực tế Đà Nẵng (quán cafe yên tĩnh làm việc đạt 71.89%, ẩm thực đặc sản chợ đêm đạt 72.93%, điểm tham quan cảnh đẹp đạt 69.26%).
- [x] **Unit Tests & Real DB Integration Tests** — 22/22 Unit Tests PASS 100% (`places.service.spec.ts`, `places.controller.spec.ts`) và test thực tế trên **2,124 địa điểm Đà Nẵng** trong PostgreSQL trả về kết quả chính xác trong vài miligiây.

### DONE — PHASE 5: Personalized Itinerary Planner AI & Multi-Modal Transit Engine

- [x] **Itinerary Database Schema & Models**:
  - `itineraries`: Lưu trữ toàn bộ chuyến đi đa ngày, destination, budget, estimated cost, transit mode, hỗ trợ cả User đăng nhập & Guest, soft delete `deletedAt`.
  - `itinerary_destinations`: Chi tiết hoạt động từng ngày (`dayNumber`, `visitOrder`, `startTime`, `endTime`, `estimatedDurationMinutes`, `estimatedCost`, `notes`, tọa độ GPS).
  - `transit_hubs` & `transit_routes`: Mạng lưới kết nối sân bay, ga tàu, bến xe liên tỉnh toàn quốc.
- [x] **AI Itinerary Generator Service (Gemini 2.5 Flash Structured Output)**:
  - Tích hợp Gemini 2.5 Flash qua `@google/genai` với **Structured Outputs** (`responseMimeType: 'application/json'`, `responseSchema`).
  - **Candidate Places Injection**: Ưu tiên gợi ý các địa điểm có thật từ DB dựa trên đánh giá sao, số lượng review, chủ đề (ẩm thực đặc sản, cafe, điểm tham quan...).
  - Prompt chuẩn phân bổ thời gian hợp lý (sáng, trưa, nghỉ ngơi, chiều, hoàng hôn, tối) và phân chia ngân sách theo ngày.
- [x] **Bounding Box Địa Lý & Spatial Isolation Guards (Chống rò rỉ địa điểm chéo tỉnh)**:
  - **Root Cause & Fix**: Xử lý triệt để lỗi chuyến đi Phú Quốc chứa địa điểm Đà Nẵng bằng thuật toán Bounding Box địa lý, **hoàn toàn không cần seed DB thủ công**.
  - **Country Guard**: Khi điểm đến map về `area_id = 1` (Việt Nam) hoặc cấp quốc gia (`type: COUNTRY`), tự động ngắt không mở rộng tìm kiếm xuống 63 tỉnh con.
  - **Dynamic Bounding Box GPS**: Tự động tính hộp tọa độ bao quanh điểm đến (bán kính chuẩn ~45km):
    $$\Delta\text{lat} = \frac{R}{111}, \quad \Delta\text{lng} = \frac{R}{111 \times \cos(\text{lat})}$$
  - **Candidate Places Filtering**: Lọc trực tiếp `latitude/longitude` trong Bounding Box, loại bỏ 100% rác ngoại tỉnh.
  - **Strict Location Prompting**: Cung cấp tọa độ tâm điểm đến, cấm Gemini gợi ý địa điểm ngoài địa phương.
  - **Deduplication Spatial Guard**: Kiểm tra trùng lặp tên địa điểm (`tx.place.findFirst`) ràng buộc trong Bounding Box, tránh liên kết nhầm chuỗi quán cùng tên ở tỉnh khác (Cộng Cà Phê, Highlands...).
  - **Coordinate Sanitizer**: Ép các địa điểm mới sinh ra ngoài Bounding Box về tâm điểm đến, dọn sạch tên tỉnh thành ngoại lai khỏi địa chỉ.
- [x] **Intercity Transit Engine (Strategy Pattern)**:
  - `TransitService` với 4 chiến lược vận tải: `FlightStrategy`, `TrainStrategy`, `BusStrategy`, `RoadStrategy` (Ô tô & Xe máy).
  - Ước lượng chính xác thời gian, cự ly, khoảng giá vé và tự động sinh **Deep Links đặt vé trực tiếp** (Vietnam Airlines, Vietjet Air, Vexere, Vé tàu DSVN, Google Maps).
  - Cung cấp API `POST /api/v1/itineraries/transit-preview` (tính nhanh) và `PATCH /api/v1/itineraries/:id/transit-mode` (đổi phương tiện & tính lại chi phí).
- [x] **Intra-city Routing & Polyline Optimization**:
  - Tích hợp VietMap GL & OSRM Engine cho tuyến đường thực tế (motorcycle/driving).
  - Hỗ trợ Multi-stop Routing & Fallback theo cặp điểm liên tiếp.
  - Phân màu lộ trình riêng biệt theo từng ngày (`getDayColor`): Ngày 1: Ngọc bích (Teal), Ngày 2: Hổ phách (Amber), Ngày 3: Chàm (Indigo), Ngày 4: Hồng đỏ (Rose), Ngày 5+: Lam đá (Slate/Blue).
- [x] **Itinerary Management APIs (CRUD & Bulk)**:
  - `POST /api/v1/itineraries/generate`: Tạo lịch trình AI đầy đủ (hỗ trợ User & Guest).
  - `POST /api/v1/itineraries/transit-preview`: Xem trước chi phí/thời gian liên tỉnh.
  - `GET /api/v1/itineraries/:id`: Xem chi tiết lịch trình kèm danh sách ngày, hoạt động và thông tin transit.
  - `GET /api/v1/itineraries`: Danh sách chuyến đi gần đây.
  - `DELETE /api/v1/itineraries/:id`: Xóa mềm chuyến đi, bảo vệ an toàn tuyệt đối các bản sao đã được clone.
  - `POST /api/v1/itineraries/:id/clone`: Nhân bản chuyến đi vào tài khoản cá nhân.
  - `POST /api/v1/itineraries/bulk-delete`: Xóa hàng loạt an toàn.
  - `PATCH /api/v1/itineraries/:id/transit-mode`: Cập nhật phương tiện liên tỉnh & cập nhật chi phí tổng.
- [x] **Frontend Itinerary Wizard & Interactive Trip Detail View**:
  - `ItineraryWizardModal.tsx`: Wizard 4 bước trực quan, tự động tính trước transit, preview lộ trình, chọn ngân sách, phong cách và thành viên.
  - `ItineraryView.tsx`: Màn hình chi tiết chuyến đi hiện đại, xem tổng quan ngân sách `BudgetBreakdownCard`, bản đồ `ItineraryMap` tương tác, Timeline chi tiết `ItineraryTimeline`, công cụ chia sẻ/sao chép/in ấn.
  - `Genie Copilot Drawer`: Giao diện trợ lý lịch trình AI mở rộng (sẵn sàng tích hợp Tool Calling).
- [x] **Automated Integration & Verification Suite**:
  - `backend/test/test-planner-check.ts`: 9 runnable checks kiểm thử toàn bộ luồng tạo, cập nhật, clone, xóa mềm và cô lập địa lý:
    - Test 1: Khởi tạo service và kết nối DB.
    - Test 2: Tạo lịch trình Đà Nẵng 3 ngày.
    - Test 3: Truy vấn chi tiết theo ID.
    - Test 4: Danh sách lịch trình.
    - Test 5: Tính năng Clone lịch trình.
    - Test 6: Cập nhật Transit Mode (chuyển sang Tàu hỏa).
    - Test 7: Xóa mềm và kiểm tra bảo vệ bản clone.
    - Test 8: Xóa hàng loạt (Bulk Delete).
    - Test 9: **Kiểm tra cô lập địa lý Bounding Box (TP.HCM -> Phú Quốc)**: 100% địa điểm nằm tại Phú Quốc (Kiên Giang), 0 địa điểm ngoại tỉnh/Đà Nẵng.
  - Chạy lệnh: `npx ts-node -r tsconfig-paths/register test/test-planner-check.ts` ➔ **100% PASS (9/9 checks thành công)**.
  - Frontend & Backend: Typecheck `tsc --noEmit` ➔ **0 lỗi**.

### TODO — PHASE 6: AI Agentic Tool Calling & Real-time Collaboration (Tiếp theo)

- [ ] **AI Agentic Loop & Tool Calling Engine** (`ai` module):
  - Tích hợp Gemini Tool Calling (Function Calling) cho phần chỉnh sửa lịch trình tương tác.
  - Định nghĩa & đăng ký các Agent Tools nghiệp vụ:
    - `searchAlternativePlaces`: Tìm địa điểm thay thế từ DB theo Bounding Box / Category.
    - `swapItineraryActivity`: Đổi một địa điểm trong ngày thành phương án thay thế.
    - `addItineraryActivity`: Bổ sung địa điểm mới vào khung giờ trống.
    - `removeItineraryActivity`: Xóa địa điểm khỏi lịch trình.
    - `reorderDayActivities`: Sắp xếp lại thứ tự tối ưu cung đường (TSP).
  - Quản lý hội thoại và lưu vết vào hai bảng `ai_chat_sessions` & `ai_chat_messages` (`tool_calls`, `tool_results`).
  - Hỗ trợ SSE streaming (`POST /api/v1/ai/chat`) truyền luồng phản hồi trực tiếp tới client.
- [ ] **Frontend Genie Copilot Tool Calling Integration**:
  - Thay thế mock handlers hiện tại bằng kết nối SSE stream thời gian thực.
  - Cập nhật trực tiếp Timeline, Map polyline & Budget khi AI thực thi tool thành công.
- [ ] **Real-time Collaboration (Socket.IO Gateway)**:
  - Đồng bộ thay đổi lịch trình theo thời gian thực giữa các thành viên trong nhóm.
  - Bầu chọn địa điểm (Group Voting) & hiển thị trạng thái thành viên trực tuyến (Presence).

---

## 8. Files Quan Trọng

| File | Mục đích |
|------|---------|
| `docs/backend/database.md` | Schema SQL v5 — Nguồn sự thật duy nhất |
| `docs/architecture/system-architecture.md` | Architecture overview đầy đủ (27 sections) |
| `docs/architecture/project-context.md` | File này — Living memory của dự án |

