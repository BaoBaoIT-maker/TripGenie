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

## 6. Database Schema (v5 — Source of Truth: `docs/DB.md`)

- **29 bảng**, **15 enums**, **5 triggers**, **1 view** (`active_places`), **6 extensions** (`uuid-ossp`, `postgis`, `vector`, `pg_trgm`, `citext`, `unaccent`).
- **Prisma Schema**: `trip-genie/prisma/schema.prisma` khớp 100% với `docs/DB.md` v5.

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

### TODO — PHASE 4: Places & Search API (Tiếp theo)

- [ ] Place Detail API (`GET /places/:id` — thông tin chi tiết địa điểm, hình ảnh, nguồn cào)
- [ ] Spatial & Hybrid Search API (`GET /places/search` — PostGIS + pgvector + pg_trgm)
- [ ] User Profile Management API (`GET /users/me`, `PATCH /users/me`)
- [ ] User Preferences API (`GET /users/preferences`, `PUT /users/preferences`)
- [ ] Unit & E2E Tests cho Places Module

---

## 8. Files Quan Trọng

| File | Mục đích |
|------|---------|
| `docs/DB.md` | Schema SQL v5 — Nguồn sự thật duy nhất |
| `docs/ARCHITECTURE.md` | Architecture overview đầy đủ (27 sections) |
| `docs/Project-context.md` | File này — Living memory của dự án |

