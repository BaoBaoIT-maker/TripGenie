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

### DONE — PHASE 2: Auth Module

- [x] **DTOs** — `RegisterDto`, `LoginDto`, `VerifyOtpDto`, `RefreshTokenDto`
- [x] **UsersRepository & IUsersRepository** — Interface DI token `USER_REPOSITORY`
- [x] **MailService** — Gửi mail OTP 6 số qua Gmail SMTP với `nodemailer`
- [x] **AuthService** — bcrypt hash, Redis OTP (10 min TTL), JWT issue (1d/7d)
- [x] **Passport Strategies** — `JwtStrategy` (dual cookie/header extractor), `GoogleStrategy`, `FacebookStrategy`
- [x] **HttpOnly Cookie Support & Logout** — Auto set `accessToken` & `refreshToken` cookies, `POST /auth/logout` clear cookies
- [x] **AuthController** — Endpoints: `/auth/register`, `/auth/verify-otp`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/google`, `/auth/facebook`, `/auth/me`
- [x] **Unit Tests** — `auth.service.spec.ts`, `auth.controller.spec.ts` ➔ **100% PASS**
- [x] **E2E Tests** — `test/auth.e2e-spec.ts` ➔ **100% PASS**

### TODO — PHASE 3: Users Module (Tiếp theo)

- [ ] User Profile Management API (`GET /users/me`, `PATCH /users/me`)
- [ ] User Preferences API (`GET /users/preferences`, `PUT /users/preferences` — budget, dietary, categories, travel style)
- [ ] Unit & E2E Tests cho Users Module

---

## 8. Files Quan Trọng

| File | Mục đích |
|------|---------|
| `docs/DB.md` | Schema SQL v5 — Nguồn sự thật duy nhất |
| `docs/ARCHITECTURE.md` | Architecture overview đầy đủ (27 sections) |
| `docs/Project-context.md` | File này — Living memory của dự án |
