# TripGenie — System Architecture Design

> **Vai trò:** Senior Software Architect + Senior Backend Engineer + Senior Data Engineer + AI Engineer
> **Phiên bản:** 1.0 — Architecture Design Only (chưa có code)

---

## Mục lục

1. [Tổng quan Architecture](#1-tổng-quan-architecture)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Database ERD](#3-database-erd)
4. [Database Schema](#4-database-schema)
5. [PostGIS Architecture](#5-postgis-architecture)
6. [pgvector Architecture](#6-pgvector-architecture)
7. [Crawler Architecture](#7-crawler-architecture)
8. [Provider Architecture](#8-provider-architecture)
9. [Data Ingestion Pipeline](#9-data-ingestion-pipeline)
10. [Deduplication Strategy](#10-deduplication-strategy)
11. [Synchronization Strategy](#11-synchronization-strategy)
12. [Recommendation Pipeline](#12-recommendation-pipeline)
13. [Ranking Algorithm](#13-ranking-algorithm)
14. [Clustering Strategy](#14-clustering-strategy)
15. [Routing Strategy](#15-routing-strategy)
16. [Itinerary Algorithm](#16-itinerary-algorithm)
17. [AI Agent Architecture](#17-ai-agent-architecture)
18. [RAG Architecture](#18-rag-architecture)
19. [Redis / BullMQ Architecture](#19-redis--bullmq-architecture)
20. [API Design](#20-api-design)
21. [NestJS Module Structure](#21-nestjs-module-structure)
22. [Deployment Architecture](#22-deployment-architecture)
23. [Security](#23-security)
24. [Performance](#24-performance)
25. [Testing](#25-testing)
26. [Implementation Roadmap](#26-implementation-roadmap)

---

## 1. Tổng quan Architecture

### Mô hình tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER (Browser)                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / WebSocket / SSE
┌──────────────────────────────▼──────────────────────────────────────┐
│                        NestJS API (Port 3000)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Auth Module │  │ Places Module│  │  Recommendation Module   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Itinerary   │  │  AI / Agent  │  │       RAG Module         │   │
│  │  Module      │  │  Module      │  └──────────────────────────┘   │
│  └──────────────┘  └──────────────┘                                 │
└───────┬──────────────┬──────────────┬────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌───────────┐  ┌──────────────┐  ┌──────────────────┐
│ PostgreSQL│  │    Redis     │  │  Routing Engine  │
│ + PostGIS │  │  (Cache/Q)   │  │  (OSRM/ORS)      │
│ + pgvector│  └──────┬───────┘  └──────────────────┘
└───────────┘         │
                       ▼ BullMQ Queue
              ┌────────────────────┐
              │  Crawler Worker    │
              │  (Separate Process)│
              └────────┬───────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     OSM Provider  Google Places  Other Providers
                       │
                       ▼
                 LLM / Embedding
                 (Gemini / OpenAI)
```

### Nguyên tắc thiết kế cốt lõi

| Layer | Trách nhiệm | Không làm |
|-------|------------|-----------|
| **LLM** | Intent parsing, tool calling, NLG | Quyết định business logic, write DB trực tiếp |
| **PostgreSQL** | Business data storage | Spatial/vector computation |
| **PostGIS** | Geospatial: nearby, distance, clustering | Route planning trên road network |
| **pgvector** | Semantic search, RAG | Exact filter (price/rating) |
| **Redis** | Cache, queue, session | Long-term data storage |
| **BullMQ** | Background job scheduling | Synchronous HTTP request processing |
| **Crawler Worker** | Data ingestion từ external sources | Xử lý HTTP request của user |
| **Routing Engine** | Road distance, travel duration, geometry | Spatial geometry |
| **Recommendation Engine** | Filtering + Scoring + Ranking | Replace LLM |

---

## 2. Monorepo Structure

### Lý do dùng Monorepo

Cho phép API và Crawler Worker **chia sẻ types, database schema, config** mà không cần publish npm package riêng, đồng thời vẫn **chạy độc lập** như hai process/container khác nhau.

### Cấu trúc thư mục

```
trip-genie/
│
├── apps/
│   ├── api/                          # NestJS HTTP API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── places/
│   │   │   │   ├── categories/
│   │   │   │   ├── recommendations/
│   │   │   │   ├── itineraries/
│   │   │   │   ├── routing/
│   │   │   │   ├── ai/
│   │   │   │   ├── rag/
│   │   │   │   ├── crawler-admin/    # Admin endpoints để trigger crawl
│   │   │   │   └── health/
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   ├── pipes/
│   │   │   │   └── filters/
│   │   │   ├── config/
│   │   │   └── main.ts
│   │   ├── test/
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── crawler/                      # Crawler Worker — process riêng
│       ├── src/
│       │   ├── providers/            # Data sources
│       │   │   ├── base.provider.ts
│       │   │   ├── osm/
│       │   │   │   ├── osm.provider.ts
│       │   │   │   └── osm.transformer.ts
│       │   │   ├── google/
│       │   │   │   ├── google.provider.ts
│       │   │   │   └── google.transformer.ts
│       │   │   └── provider.factory.ts
│       │   ├── processors/           # BullMQ Processors
│       │   │   ├── region-crawl.processor.ts
│       │   │   ├── place-sync.processor.ts
│       │   │   └── embedding.processor.ts
│       │   ├── normalizers/
│       │   │   └── place.normalizer.ts
│       │   ├── deduplication/
│       │   │   └── place.deduplicator.ts
│       │   ├── enrichment/
│       │   │   └── place.enricher.ts
│       │   ├── jobs/
│       │   │   └── crawl-scheduler.ts
│       │   ├── config/
│       │   └── main.ts               # Bootstrap NestJS app (không có HTTP server)
│       ├── Dockerfile
│       ├── nest-cli.json
│       └── package.json
│
├── packages/
│   ├── database/                     # Shared DB schema, migrations, repositories
│   │   ├── src/
│   │   │   ├── schema/               # TypeORM Entities hoặc Drizzle schema
│   │   │   ├── migrations/
│   │   │   ├── repositories/         # Shared repo interface
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared-types/                 # Shared TypeScript types/interfaces
│   │   ├── src/
│   │   │   ├── place.types.ts
│   │   │   ├── crawler.types.ts
│   │   │   ├── itinerary.types.ts
│   │   │   ├── recommendation.types.ts
│   │   │   ├── ai.types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── common/                       # Shared utilities
│       ├── src/
│       │   ├── utils/
│       │   │   ├── geo.utils.ts       # Haversine, coordinate validation
│       │   │   ├── text.utils.ts      # Normalize Vietnamese text
│       │   │   └── date.utils.ts
│       │   ├── constants/
│       │   │   ├── queue.constants.ts # Queue names
│       │   │   ├── cache.constants.ts # Cache TTL values
│       │   │   └── geo.constants.ts   # Vietnam bounding boxes
│       │   └── index.ts
│       └── package.json
│
├── docker/
│   ├── postgres/
│   │   └── init.sql                   # Extensions, initial seed
│   └── osrm/
│       └── setup.sh
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── turbo.json                         # Turborepo config (build pipeline)
├── pnpm-workspace.yaml
└── package.json
```

### Build Tool

Dùng **Turborepo** + **pnpm workspaces**.

**Lý do**: Turborepo cache build artifacts, tính toán dependency graph giữa packages, chỉ rebuild những gì thay đổi. pnpm workspace cho phép `import '@trip-genie/shared-types'` từ bất kỳ app nào.

---

## 3. Database ERD

### Diagram (Entity Relationship)

```
users ─────────────────────────────────────────────────────────────┐
  │                                                                 │
  ├── user_identities (OAuth: Google, Facebook, GitHub)            │
  ├── user_preferences (1:1 — travel profile)                      │
  ├── reviews (1:N → places)                                       │
  ├── collections (1:N)                                            │
  │       └── collection_places (M:N → places)                    │
  ├── itineraries (1:N)                                            │
  │       └── itinerary_destinations (1:N → places)               │
  ├── ai_chat_sessions (1:N)                                       │
  │       └── ai_chat_messages (1:N)                              │
  ├── trip_groups                                                  │
  │       ├── group_members (M:N → users)                         │
  │       └── group_place_proposals                               │
  │               └── group_place_votes (M:N → users)             │
  └── community_posts (1:1 → itineraries)                         │
          ├── post_likes (M:N → users)                            │
          └── post_comments (1:N → users)                         │
                                                                   │
places ─────────────────────────────────────────────────────────────┘
  │   category_id  → categories
  │   area_id      → travel_areas [MỚI — cần thêm]
  ├── place_images (1:N)
  ├── reviews (1:N ← users)
  ├── place_embeddings (1:1)
  └── place_sources (1:N) [MỚI — cần thêm]

categories           (self-ref parent_id [MỚI — cần thêm])
travel_areas         [MỚI — cần thêm]
data_coverage        [MỚI — cần thêm]
crawl_jobs           [MỚI — cần thêm]

knowledge_documents  [MỚI — cần thêm]
  └── knowledge_chunks (1:N, với embedding) [MỚI — cần thêm]
```

---

## 4. Database Schema

> **Nguồn thực tế:** Schema hiện có trong [`docs/DB.md`](./DB.md)  
> Section này gồm 4 phần: (4.1) schema hiện tại đúng với DB.md, (4.2) phân tích, (4.3) migration bổ sung, (4.4) bảng trạng thái.

---

### 4.1 Schema hiện tại (DB.md — ground truth)

```sql
-- =============================================================================
-- EXTENSIONS (đã có)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- ENUMS (đã có)
-- =============================================================================
CREATE TYPE user_role_enum     AS ENUM ('ADMIN', 'USER');
CREATE TYPE auth_provider_enum AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK', 'GITHUB');
CREATE TYPE budget_level_enum  AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'LUXURY');
CREATE TYPE place_status_enum  AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');
CREATE TYPE chat_sender_enum   AS ENUM ('USER', 'AGENT', 'TOOL');

-- =============================================================================
-- USERS & AUTH (đã có)
-- =============================================================================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name     VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    phone_number  VARCHAR(20),
    role          user_role_enum DEFAULT 'USER',
    is_active     BOOLEAN DEFAULT true,
    is_verified   BOOLEAN DEFAULT false,
    verified_at   TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_identities (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         auth_provider_enum NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    identity_data    JSONB,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_provider_user UNIQUE(provider, provider_user_id)
);

-- 1:1 với users — travel profile
CREATE TABLE user_preferences (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dietary_restrictions TEXT[],
    preferred_categories TEXT[],
    budget_level         budget_level_enum DEFAULT 'MEDIUM',
    travel_style         TEXT[],
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PLACES & RAG DATA (đã có)
-- =============================================================================

CREATE TABLE categories (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    slug     VARCHAR(100) UNIQUE NOT NULL,
    icon_url TEXT
);

CREATE TABLE places (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
    address       TEXT NOT NULL,
    district      VARCHAR(100),
    city          VARCHAR(100) DEFAULT 'Hồ Chí Minh',
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    location      GEOGRAPHY(POINT, 4326),  -- Auto-populated bởi trigger
    price_range   JSONB,     -- `{ "min": 30000, "max": 150000, "currency": "VND" }`
    opening_hours JSONB,     -- `{ "monday": { "open": "07:00", "close": "22:00" }, ... }`
    rating_avg    FLOAT DEFAULT 0.0,
    review_count  INT DEFAULT 0,
    status        place_status_enum DEFAULT 'ACTIVE',
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE place_images (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id      UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_primary    BOOLEAN DEFAULT false,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vector embedding cho semantic search (1:1 per place)
CREATE TABLE place_embeddings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id      UUID UNIQUE NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    content_chunk TEXT NOT NULL,   -- Text dùng để generate embedding
    embedding     VECTOR(1536),    -- OpenAI text-embedding-3-small
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- REVIEWS & COLLECTIONS (đã có)
-- =============================================================================

CREATE TABLE reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id   UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    rating     INT CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    images     TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_place_review UNIQUE(user_id, place_id)
);

CREATE TABLE collections (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    is_public  BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_places (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    place_id      UUID REFERENCES places(id) ON DELETE CASCADE,
    added_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, place_id)
);

-- =============================================================================
-- ITINERARIES & GROUPS (đã có)
-- =============================================================================

CREATE TABLE itineraries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    total_budget    DECIMAL(12, 2),
    is_public       BOOLEAN DEFAULT false,
    is_ai_generated BOOLEAN DEFAULT false,
    cloned_from_id  UUID REFERENCES itineraries(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE itinerary_destinations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id            UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    place_id                UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    day_number              INT DEFAULT 1,
    visit_order             INT NOT NULL,
    start_time              TIME,
    end_time                TIME,
    estimated_cost          DECIMAL(10, 2),
    travel_distance_meters  INT,
    travel_duration_seconds INT,
    notes                   TEXT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_groups (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    invite_code  VARCHAR(20) UNIQUE NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    role          VARCHAR(20) DEFAULT 'MEMBER',
    joined_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_group_id, user_id)
);

CREATE TABLE group_place_proposals (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
    place_id      UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    proposed_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_group_place_proposal UNIQUE(trip_group_id, place_id)
);

CREATE TABLE group_place_votes (
    proposal_id UUID REFERENCES group_place_proposals(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proposal_id, user_id)
);

-- =============================================================================
-- AI CHAT (đã có)
-- =============================================================================

CREATE TABLE ai_chat_sessions (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                      VARCHAR(255) DEFAULT 'Trò chuyện mới',
    summary                    TEXT,       -- Compressed conversation memory
    last_summarized_message_id UUID,       -- Checkpoint, không dùng FK
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_chat_messages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    sender     chat_sender_enum NOT NULL,
    content    TEXT,
    tool_calls JSONB,   -- Array of { name, arguments, result }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- COMMUNITY (đã có)
-- =============================================================================

CREATE TABLE community_posts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    itinerary_id UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    caption      TEXT,
    like_count   INT NOT NULL DEFAULT 0,
    clone_count  INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES (đã có)
-- =============================================================================

-- Spatial & Vector
CREATE INDEX idx_places_location         ON places USING GIST (location);
CREATE INDEX idx_place_embeddings_hnsw   ON place_embeddings USING hnsw (embedding vector_cosine_ops);

-- Places
CREATE INDEX idx_places_category                  ON places(category_id);
CREATE INDEX idx_places_district                  ON places(district);
CREATE INDEX idx_place_images_place               ON place_images(place_id);
CREATE INDEX idx_itinerary_destinations_order     ON itinerary_destinations(itinerary_id, day_number, visit_order);

-- Community feed (cursor pagination)
CREATE INDEX idx_community_posts_created          ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_user_created     ON community_posts(user_id, created_at DESC);
CREATE INDEX idx_post_comments_post_created       ON post_comments(post_id, created_at DESC);

-- FK indexes
CREATE INDEX idx_reviews_user              ON reviews(user_id);
CREATE INDEX idx_reviews_place             ON reviews(place_id);
CREATE INDEX idx_collections_user          ON collections(user_id);
CREATE INDEX idx_itineraries_creator       ON itineraries(creator_id);
CREATE INDEX idx_group_members_user        ON group_members(user_id);
CREATE INDEX idx_ai_chat_sessions_user     ON ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_messages_session  ON ai_chat_messages(session_id);

-- =============================================================================
-- TRIGGER (đã có)
-- =============================================================================

-- Auto-populate PostGIS location từ lat/lng
CREATE OR REPLACE FUNCTION update_places_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_places_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON places
FOR EACH ROW EXECUTE FUNCTION update_places_location();
```

---

### 4.2 Phân tích & Đánh giá DB.md

| # | Điểm cần xem xét | Mức độ | Phân tích |
|---|-----------------|--------|-----------|
| 1 | `categories` thiếu `parent_id` | **Nên có** | Không filter được theo category tree (Ăn uống → Nhà hàng, Cafe, Street food). Cần `parent_id INT REFERENCES categories(id)`. |
| 2 | `places.city DEFAULT 'Hồ Chí Minh'` | **Cần sửa** | Hard-code. Khi crawl Đà Nẵng mà quên set city thì default về HCM. Bỏ DEFAULT, thêm `area_id` FK. |
| 3 | `reviews.images TEXT[]` | **Cải thiện** | Đủ cho đồ án. Nếu cần gallery metadata (order/caption) thì tách thành `review_images` table. |
| 4 | Thiếu `place_sources` | **Bắt buộc** | Crawler không thể: (a) biết place crawl từ đâu, (b) dedup theo external_id, (c) sync định kỳ. |
| 5 | Thiếu `crawl_jobs` | **Bắt buộc** | Không track trạng thái job, không checkpoint resume, không dead-letter. |
| 6 | Thiếu `knowledge_documents` + `knowledge_chunks` | **Bắt buộc** | RAG không có corpus. `place_embeddings` chỉ dùng cho place semantic search, không phải travel Q&A. |
| 7 | Thiếu `travel_areas` | **Nên có** | Cần cho: crawl targeting theo tỉnh/thành, check coverage, bounding box spatial queries. |
| 8 | Thiếu `data_coverage` | **Nên có** | Không thể check nhanh "Ninh Thuận đủ data chưa?" mà không COUNT(*) mỗi lần. |
| 9 | `itinerary_destinations` flat | **Đủ dùng** | `day_number INT` đủ cho đồ án. Tách `itinerary_days + itinerary_items` nếu cần per-day summary. |
| 10 | `place_embeddings.content_chunk` | **Đủ dùng** | 1 embedding/place đúng cho semantic search. Tên `content_chunk` gợi ý nhiều chunks, nên đổi thành `content_text`. |
| 11 | `place_status_enum` thiếu `'DUPLICATE'` | **Nên có** | Dedup cần mark duplicate thay vì xóa để audit. |
| 12 | Thiếu `pg_trgm` extension | **Nên có** | Cần cho fuzzy name matching (`similarity()`, `%` operator). |
| 13 | `places` thiếu `tags TEXT[]` | **Nên có** | Tags `['rooftop', 'pet-friendly', 'wifi']` làm giàu embedding và hỗ trợ advanced filtering. |
| 14 | `ai_chat_sessions` thiếu `linked_itinerary_id` | **Nên có** | Khi AI tạo itinerary trong chat, cần link để user quay lại sửa. |
| 15 | `budget_level_enum ('LOW','MEDIUM','HIGH','LUXURY')` | **OK** | Đủ dùng cho đồ án. |

---

### 4.3 Migration: Bổ sung vào schema hiện tại

> Script này chạy **SAU** schema trong `DB.md`, không thay thế.

```sql
-- =============================================================================
-- MIGRATION 001: Extensions & Enums bổ sung
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

ALTER TYPE place_status_enum ADD VALUE IF NOT EXISTS 'DUPLICATE';

CREATE TYPE crawl_job_type_enum   AS ENUM ('REGION_CRAWL', 'PLACE_SYNC', 'EMBEDDING_GEN');
CREATE TYPE crawl_job_status_enum AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE sync_status_enum      AS ENUM ('OK', 'STALE', 'ERROR', 'PENDING');
CREATE TYPE coverage_status_enum  AS ENUM ('COMPLETE', 'PARTIAL', 'NOT_COVERED', 'STALE');
CREATE TYPE itinerary_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- =============================================================================
-- MIGRATION 002: Cải tiến bảng hiện có
-- =============================================================================

-- categories: thêm hierarchy + tên tiếng Việt
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_vi    VARCHAR(100);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id  INT REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- places: bổ sung các field còn thiếu
ALTER TABLE places ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(255);  -- lowercase, no diacritics
ALTER TABLE places ADD COLUMN IF NOT EXISTS province        VARCHAR(100);
ALTER TABLE places ADD COLUMN IF NOT EXISTS country         VARCHAR(50) DEFAULT 'Vietnam';
ALTER TABLE places ADD COLUMN IF NOT EXISTS price_level     budget_level_enum;  -- denormalized fast filter
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone           VARCHAR(30);
ALTER TABLE places ADD COLUMN IF NOT EXISTS website         TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS tags            TEXT[] DEFAULT '{}';
ALTER TABLE places ADD COLUMN IF NOT EXISTS attributes      JSONB DEFAULT '{}';
ALTER TABLE places ADD COLUMN IF NOT EXISTS image_count     INT DEFAULT 0;
ALTER TABLE places ADD COLUMN IF NOT EXISTS merged_into     UUID REFERENCES places(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS area_id         INT;     -- FK sau khi có travel_areas
ALTER TABLE places ALTER COLUMN city DROP DEFAULT;                   -- Bỏ DEFAULT 'Hồ Chí Minh'

-- place_images: thêm metadata
ALTER TABLE place_images ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE place_images ADD COLUMN IF NOT EXISTS caption        TEXT;
ALTER TABLE place_images ADD COLUMN IF NOT EXISTS source         VARCHAR(50);  -- 'user_upload','google','osm'
ALTER TABLE place_images ADD COLUMN IF NOT EXISTS width          INT;
ALTER TABLE place_images ADD COLUMN IF NOT EXISTS height         INT;

-- place_embeddings: rename content_chunk → content_text, thêm model info
ALTER TABLE place_embeddings RENAME COLUMN content_chunk TO content_text;
ALTER TABLE place_embeddings ADD COLUMN IF NOT EXISTS model_name    VARCHAR(100);
ALTER TABLE place_embeddings ADD COLUMN IF NOT EXISTS model_version VARCHAR(50);

-- reviews: thêm fields, đổi tên thành place_reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title         VARCHAR(255);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS visited_at    DATE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INT DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE reviews RENAME TO place_reviews;

-- collections: thêm description, cover_image; đổi default is_public = false
ALTER TABLE collections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE collections ALTER COLUMN is_public SET DEFAULT false;

-- collection_places: thêm notes
ALTER TABLE collection_places ADD COLUMN IF NOT EXISTS notes TEXT;

-- itineraries: thêm AI metadata và status
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS destination    VARCHAR(255);
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS area_id        INT;   -- FK sau khi có travel_areas
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS budget_level   budget_level_enum;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12, 2);
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS status         itinerary_status_enum DEFAULT 'DRAFT';
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS ai_prompt      TEXT;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS ai_preferences JSONB;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS total_places   INT DEFAULT 0;

-- ai_chat_sessions: link to itinerary, thêm context
ALTER TABLE ai_chat_sessions ADD COLUMN IF NOT EXISTS linked_itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL;
ALTER TABLE ai_chat_sessions ADD COLUMN IF NOT EXISTS context_city        VARCHAR(100);
ALTER TABLE ai_chat_sessions ADD COLUMN IF NOT EXISTS message_count       INT DEFAULT 0;
ALTER TABLE ai_chat_sessions ADD COLUMN IF NOT EXISTS last_summarized_at  TIMESTAMP WITH TIME ZONE;

-- ai_chat_messages: thêm tool_results và observability fields
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS tool_results JSONB;
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS token_count  INT;
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS latency_ms   INT;
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS model_name   VARCHAR(100);

-- community_posts: thêm comment_count
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;

-- =============================================================================
-- MIGRATION 003: Bảng mới cần tạo
-- =============================================================================

-- travel_areas: metadata cho 63 tỉnh thành VN + tourist zones
CREATE TABLE IF NOT EXISTS travel_areas (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    name_vi      VARCHAR(100),
    slug         VARCHAR(100) UNIQUE NOT NULL,
    type         VARCHAR(50) NOT NULL,  -- 'province', 'city', 'district', 'zone'
    parent_id    INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    bbox_min_lat DOUBLE PRECISION,
    bbox_max_lat DOUBLE PRECISION,
    bbox_min_lng DOUBLE PRECISION,
    bbox_max_lng DOUBLE PRECISION,
    boundary     GEOGRAPHY(POLYGON, 4326),  -- Polygon cho ST_Within
    is_active    BOOLEAN DEFAULT true
);

-- FK từ places và itineraries sau khi tạo travel_areas
ALTER TABLE places      ADD CONSTRAINT fk_places_area      FOREIGN KEY (area_id) REFERENCES travel_areas(id) ON DELETE SET NULL;
ALTER TABLE itineraries ADD CONSTRAINT fk_itineraries_area FOREIGN KEY (area_id) REFERENCES travel_areas(id) ON DELETE SET NULL;

-- place_sources: data provenance — bắt buộc cho crawler & sync
CREATE TABLE IF NOT EXISTS place_sources (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id            UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    provider            VARCHAR(50) NOT NULL,    -- 'osm', 'google_places', 'tripadvisor'
    external_id         VARCHAR(255) NOT NULL,
    external_url        TEXT,
    raw_data            JSONB,                   -- Raw response để debug/re-process
    last_synced_at      TIMESTAMP WITH TIME ZONE,
    sync_status         sync_status_enum DEFAULT 'PENDING',
    sync_error          TEXT,
    sync_attempt_count  INT DEFAULT 0,
    source_rating       FLOAT,                   -- Rating từ provider (không overwrite places.rating_avg)
    source_review_count INT,
    CONSTRAINT uq_provider_external UNIQUE(provider, external_id)
);


CREATE TABLE review_images (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id   UUID NOT NULL REFERENCES place_reviews(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Vector embeddings — 1:1 với places
-- Lý do tách thành bảng riêng: embedding nặng (~6KB/vector), không cần load khi search thường
-- Khi cần semantic search thì JOIN vào
CREATE TABLE place_embeddings (
    place_id        UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
    -- Content được dùng để tạo embedding
    content_text    TEXT NOT NULL,
    -- Vector: 1536 dims cho OpenAI text-embedding-3-small
    --         768 dims cho Gemini text-embedding-004
    embedding       VECTOR(1536),
    model_name      VARCHAR(100),               -- 'text-embedding-3-small'
    model_version   VARCHAR(50),
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DATA COVERAGE & CRAWL JOBS
-- =============================================================================

-- Coverage per travel area
-- Lý do cần: Quick check "Ninh Thuận có đủ data chưa?" thay vì COUNT(*) mỗi lần
CREATE TABLE data_coverage (
    area_id         INT PRIMARY KEY REFERENCES travel_areas(id) ON DELETE CASCADE,
    place_count     INT DEFAULT 0,
    status          coverage_status_enum DEFAULT 'NOT_COVERED',
    last_crawled_at TIMESTAMPTZ,
    stale_threshold INTERVAL DEFAULT '7 days',  -- Sau bao lâu thì stale
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Job tracking cho crawler
-- Lý do cần: Admin visibility, resume capability, dead-letter tracking
CREATE TABLE crawl_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type        crawl_job_type_enum NOT NULL,
    status          crawl_job_status_enum DEFAULT 'PENDING',
    -- Target
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    place_id        UUID REFERENCES places(id) ON DELETE SET NULL,
    provider        VARCHAR(50),
    -- Config
    params          JSONB DEFAULT '{}',
    priority        INT DEFAULT 5,
    -- Progress
    total_items     INT,
    processed_items INT DEFAULT 0,
    inserted_count  INT DEFAULT 0,
    updated_count   INT DEFAULT 0,
    duplicate_count INT DEFAULT 0,
    error_count     INT DEFAULT 0,
    -- Checkpointing (resume)
    checkpoint      JSONB DEFAULT '{}',         -- e.g., { "page": 5, "cursor": "abc" }
    -- Scheduling
    scheduled_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    -- Error info
    last_error      TEXT,
    retry_count     INT DEFAULT 0,
    max_retries     INT DEFAULT 3,
    -- BullMQ job ID
    bullmq_job_id   VARCHAR(255),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- COLLECTIONS (saved places)
-- =============================================================================

CREATE TABLE collections (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    is_public   BOOLEAN DEFAULT false,
    cover_image TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_places (
    collection_id   UUID REFERENCES collections(id) ON DELETE CASCADE,
    place_id        UUID REFERENCES places(id) ON DELETE CASCADE,
    notes           TEXT,
    added_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, place_id)
);

-- =============================================================================
-- ITINERARIES
-- =============================================================================

-- Master itinerary — container cho multi-day trip
CREATE TABLE itineraries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Trip metadata
    destination     VARCHAR(255),               -- "Đà Nẵng"
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,
    num_days        INT GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
    -- Budget
    total_budget    DECIMAL(12, 2),
    budget_level    budget_level_enum,
    estimated_cost  DECIMAL(12, 2),             -- AI computed
    -- AI metadata
    is_ai_generated     BOOLEAN DEFAULT false,
    ai_prompt           TEXT,                   -- Original user prompt
    ai_preferences      JSONB,                  -- Structured preferences extracted
    -- Sharing
    status          itinerary_status_enum DEFAULT 'DRAFT',
    is_public       BOOLEAN DEFAULT false,
    cloned_from_id  UUID REFERENCES itineraries(id) ON DELETE SET NULL,
    -- Aggregate
    total_places    INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Mỗi day trong itinerary
-- Lý do tách thành bảng: mỗi day có summary, estimated cost riêng; dễ query "ngày 2"
CREATE TABLE itinerary_days (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id    UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    day_number      INT NOT NULL,               -- 1, 2, 3...
    date            DATE,
    title           VARCHAR(255),               -- "Ngày 1: Khám phá bãi biển"
    summary         TEXT,                       -- AI-generated day summary
    estimated_cost  DECIMAL(10, 2),
    -- Starting/ending point
    start_location  GEOGRAPHY(POINT, 4326),
    end_location    GEOGRAPHY(POINT, 4326),
    -- Aggregate travel
    total_distance_meters INT,
    total_duration_minutes INT,
    CONSTRAINT uq_itinerary_day UNIQUE(itinerary_id, day_number)
);

-- Items trong mỗi day
-- Lý do cần bảng này: flat `itinerary_destinations` không đủ để track timing, cost per item
CREATE TABLE itinerary_items (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id                  UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
    place_id                UUID REFERENCES places(id) ON DELETE SET NULL,
    -- Item có thể là: place, meal, transport, custom
    item_type               VARCHAR(50) NOT NULL,   -- 'place', 'meal', 'transport', 'note'
    visit_order             INT NOT NULL,
    -- Timing
    start_time              TIME,
    end_time                TIME,
    estimated_duration_minutes INT DEFAULT 60,
    -- Cost
    estimated_cost          DECIMAL(10, 2),
    -- Travel FROM previous item
    travel_from_previous    JSONB,
    -- {
    --   "distance_meters": 4800,
    --   "duration_minutes": 14,
    --   "mode": "driving",
    --   "route_geometry": "..." (encoded polyline)
    -- }
    -- Custom item info (nếu không phải place)
    custom_name             VARCHAR(255),
    custom_description      TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TRIP GROUPS (collaborative planning)
-- =============================================================================

CREATE TABLE trip_groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id    UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    invite_code     VARCHAR(20) UNIQUE NOT NULL,
    max_members     INT DEFAULT 20,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    trip_group_id   UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'MEMBER',   -- 'OWNER', 'ADMIN', 'MEMBER'
    joined_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_group_id, user_id)
);

CREATE TABLE group_place_proposals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id   UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
    place_id        UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    proposed_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_place_proposal UNIQUE(trip_group_id, place_id)
);

CREATE TABLE group_place_votes (
    proposal_id     UUID REFERENCES group_place_proposals(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proposal_id, user_id)
);

-- =============================================================================
-- AI CHAT
-- =============================================================================

CREATE TABLE ai_chat_sessions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                       VARCHAR(255) DEFAULT 'Trò chuyện mới',
    -- Linked itinerary nếu chat dẫn đến tạo/chỉnh itinerary
    linked_itinerary_id         UUID REFERENCES itineraries(id) ON DELETE SET NULL,
    -- Conversation memory compression
    summary                     TEXT,
    last_summarized_at          TIMESTAMPTZ,
    last_summarized_message_id  UUID,           -- Checkpoint, không dùng FK
    -- Context
    context_city                VARCHAR(100),   -- City đang chat về
    message_count               INT DEFAULT 0,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    sender          chat_sender_enum NOT NULL,
    content         TEXT,
    -- Tool calling metadata
    tool_calls      JSONB,  -- Array of tool call objects
    tool_results    JSONB,  -- Results from tool execution
    -- Metadata
    token_count     INT,
    latency_ms      INT,
    model_name      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- RAG — KNOWLEDGE BASE
-- =============================================================================

-- Documents nhập vào knowledge base
-- Lý do cần: quản lý nguồn gốc của knowledge, re-chunk khi cần
CREATE TABLE knowledge_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255) NOT NULL,
    source_type     VARCHAR(50) NOT NULL,       -- 'travel_guide', 'faq', 'official_site'
    source_url      TEXT,
    content         TEXT NOT NULL,
    language        VARCHAR(10) DEFAULT 'vi',
    -- Metadata cho filtering
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    category_tags   TEXT[] DEFAULT '{}',
    -- Processing state
    is_processed    BOOLEAN DEFAULT false,
    chunk_count     INT DEFAULT 0,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Chunks từ documents — đây là unit được retrieve trong RAG
-- Lý do cần: LLM context window có giới hạn, phải chunk ra và retrieve relevant chunks
CREATE TABLE knowledge_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,               -- Thứ tự trong document
    content         TEXT NOT NULL,
    -- Embedding vector
    embedding       VECTOR(1536),
    model_name      VARCHAR(100),
    -- Metadata cho filtering
    metadata        JSONB DEFAULT '{}',
    -- {
    --   "area": "Da Nang",
    --   "topic": "beaches",
    --   "language": "vi"
    -- }
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- COMMUNITY
-- =============================================================================

CREATE TABLE community_posts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    itinerary_id    UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    caption         TEXT,
    like_count      INT DEFAULT 0,
    comment_count   INT DEFAULT 0,
    clone_count     INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-populate PostGIS location từ lat/lng
CREATE OR REPLACE FUNCTION fn_update_places_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    NEW.name_normalized = lower(unaccent(NEW.name));  -- cần unaccent extension
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_places_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON places
    FOR EACH ROW EXECUTE FUNCTION fn_update_places_location();

-- Update rating_avg và review_count khi có review mới/xóa
CREATE OR REPLACE FUNCTION fn_update_place_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE places
    SET
        rating_avg   = (SELECT AVG(rating) FROM place_reviews WHERE place_id = COALESCE(NEW.place_id, OLD.place_id)),
        review_count = (SELECT COUNT(*)    FROM place_reviews WHERE place_id = COALESCE(NEW.place_id, OLD.place_id)),
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.place_id, OLD.place_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_place_rating
    AFTER INSERT OR UPDATE OR DELETE ON place_reviews
    FOR EACH ROW EXECUTE FUNCTION fn_update_place_rating();
```

### 4.4 Tổng hợp trạng thái từng bảng

| Bảng | Trạng thái | Hành động |
|------|-----------|-----------|
| `users` | ✅ DB.md | Giữ nguyên |
| `user_identities` | ✅ DB.md | Giữ nguyên |
| `user_preferences` | ✅ DB.md | Giữ nguyên |
| `categories` | ✅ DB.md | Thêm `parent_id`, `name_vi`, `sort_order` |
| `places` | ✅ DB.md | Thêm `name_normalized`, `price_level`, `tags`, `phone`, `website`, `area_id`, `merged_into`; bỏ `DEFAULT 'Hồ Chí Minh'` |
| `place_images` | ✅ DB.md | Thêm `thumbnail_url`, `caption`, `source` |
| `place_embeddings` | ✅ DB.md | Rename `content_chunk → content_text`, thêm `model_name` |
| `reviews` | ✅ DB.md | Rename → `place_reviews`; thêm `title`, `visited_at`, `helpful_count` |
| `collections` | ✅ DB.md | Thêm `description`, `cover_image`; đổi default `is_public = false` |
| `collection_places` | ✅ DB.md | Thêm `notes` |
| `itineraries` | ✅ DB.md | Thêm `status`, `ai_prompt`, `ai_preferences`, `area_id`, `estimated_cost` |
| `itinerary_destinations` | ✅ DB.md | Đủ dùng; tách `itinerary_days + itinerary_items` nếu cần per-day summary |
| `trip_groups` | ✅ DB.md | Giữ nguyên |
| `group_members` | ✅ DB.md | Giữ nguyên |
| `group_place_proposals` | ✅ DB.md | Giữ nguyên |
| `group_place_votes` | ✅ DB.md | Giữ nguyên |
| `ai_chat_sessions` | ✅ DB.md | Thêm `linked_itinerary_id`, `context_city`, `last_summarized_at` |
| `ai_chat_messages` | ✅ DB.md | Thêm `tool_results`, `token_count`, `model_name` |
| `community_posts` | ✅ DB.md | Thêm `comment_count` |
| `post_likes` | ✅ DB.md | Giữ nguyên |
| `post_comments` | ✅ DB.md | Giữ nguyên |
| **`travel_areas`** | ❌ Thiếu | **Tạo mới** (Migration 003) |
| **`place_sources`** | ❌ Thiếu | **Tạo mới** (Migration 003) |
| **`data_coverage`** | ❌ Thiếu | **Tạo mới** (Migration 003) |
| **`crawl_jobs`** | ❌ Thiếu | **Tạo mới** (Migration 003) |
| **`knowledge_documents`** | ❌ Thiếu | **Tạo mới** (Migration 003) |
| **`knowledge_chunks`** | ❌ Thiếu | **Tạo mới** (Migration 003) |


---

## 5. PostGIS Architecture

### Tại sao cần PostGIS?

PostgreSQL không có khái niệm spatial natively. PostGIS thêm:
- Kiểu dữ liệu `GEOGRAPHY` và `GEOMETRY`
- Hàm spatial: `ST_DWithin`, `ST_Distance`, `ST_ClusterDBSCAN`...
- Spatial index (GiST) cho queries O(log n) thay vì O(n)

**Nếu không dùng**: phải tính Haversine formula trong application code, không có index, query 10K+ places sẽ full scan.

### Indexes

```sql
-- GiST index trên location column — bắt buộc cho spatial queries
CREATE INDEX idx_places_location ON places USING GIST (location);

-- Compound index cho filter + spatial
CREATE INDEX idx_places_city_location ON places (city) INCLUDE (location);
CREATE INDEX idx_places_category_location ON places (category_id) INCLUDE (location);
CREATE INDEX idx_places_status ON places (status) WHERE status = 'ACTIVE';

-- GiST index cho travel_areas boundary polygon
CREATE INDEX idx_travel_areas_boundary ON travel_areas USING GIST (boundary);

-- pg_trgm index cho fuzzy name matching (deduplication)
CREATE INDEX idx_places_name_trgm ON places USING GIN (name_normalized gin_trgm_ops);
```

### Spatial Operations

#### 1. Nearby Search (ST_DWithin)

```sql
-- Tìm restaurant trong 5km của user
SELECT p.*, ST_Distance(p.location, ST_MakePoint($lng, $lat)::geography) AS distance_m
FROM places p
WHERE
    p.status = 'ACTIVE'
    AND p.category_id IN (SELECT id FROM categories WHERE slug = 'restaurant')
    AND ST_DWithin(
        p.location,
        ST_MakePoint($lng, $lat)::geography,
        5000  -- 5000 meters = 5km
    )
ORDER BY distance_m ASC
LIMIT 20;
```

**Dùng khi**: User bật location, tìm "gần tôi".

#### 2. Distance Calculation (ST_Distance)

```sql
-- Tính khoảng cách giữa 2 places (geographic = meters)
SELECT ST_Distance(
    ST_MakePoint(108.2022, 16.0544)::geography,  -- Đà Nẵng A
    ST_MakePoint(108.2150, 16.0427)::geography   -- Đà Nẵng B
) AS distance_meters;
```

**Lưu ý**: ST_Distance với GEOGRAPHY trả về meters. Đây là crow-fly distance, KHÔNG phải road distance. Road distance dùng Routing Engine.

#### 3. Bounding Box Search (ST_MakeEnvelope + ST_Within)

```sql
-- Tìm tất cả places trong bbox Đà Nẵng
SELECT * FROM places
WHERE ST_Within(
    location::geometry,
    ST_MakeEnvelope(107.8, 15.9, 108.5, 16.3, 4326)  -- minLng, minLat, maxLng, maxLat
);
```

**Dùng khi**: Crawl theo region, map viewport filtering.

#### 4. Region/Polygon Filtering (ST_Intersects)

```sql
-- Tìm places trong boundary polygon của Đà Nẵng (từ travel_areas)
SELECT p.*
FROM places p
JOIN travel_areas ta ON ta.slug = 'da-nang'
WHERE ST_Intersects(p.location, ta.boundary);
```

#### 5. Spatial Clustering (ST_ClusterDBSCAN)

```sql
-- Cluster places theo vị trí địa lý
WITH clustered AS (
    SELECT
        id, name, latitude, longitude,
        ST_ClusterDBSCAN(location::geometry, eps := 0.01, minpoints := 3)
            OVER () AS cluster_id
    FROM places
    WHERE city = 'Đà Nẵng' AND status = 'ACTIVE'
)
SELECT
    cluster_id,
    COUNT(*) AS place_count,
    AVG(latitude) AS center_lat,
    AVG(longitude) AS center_lng,
    array_agg(id) AS place_ids
FROM clustered
GROUP BY cluster_id
ORDER BY place_count DESC;
```

**eps = 0.01 degrees ≈ 1.1km** — điều chỉnh tùy mục đích.

#### 6. Nearest Neighbor (ORDER BY ST_Distance + LIMIT)

```sql
-- 10 places gần nhất với một điểm
SELECT id, name, ST_Distance(location, $ref_point::geography) AS dist_m
FROM places
WHERE status = 'ACTIVE'
ORDER BY location <-> $ref_point::geography  -- KNN operator (dùng GiST index)
LIMIT 10;
```

**`<->` operator** dùng GiST index, nhanh hơn ORDER BY ST_Distance.

---

## 6. pgvector Architecture

### Tại sao cần pgvector?

SQL filtering (price, rating, category) chỉ match exact/range — không hiểu ngữ nghĩa. User nói "lãng mạn, yên tĩnh" — không có column nào chứa từ này.

pgvector cho phép tìm places có **ngữ nghĩa tương tự** với query vector.

**Nếu không dùng**: Phải hard-code mapping (romantic → category: fine_dining), mất độ linh hoạt.

### Embedding Strategy

```
Content được embed cho places:
─────────────────────────────
{name} là một {category} ở {city}, {district}.
{description}
Giá: {price_range}.
Tags: {tags.join(', ')}.
Nổi bật: {top_attributes}.
```

Ví dụ: `"Cơm Nhà Hàng Lãng Mạn là một nhà hàng ở Đà Nẵng, quận Hải Châu. Không gian yên tĩnh, view sông Hàn, ánh đèn mờ ảo. Giá: 200.000–400.000 VND. Tags: rooftop, romantic, sunset-view."`

**Model**: `text-embedding-3-small` (OpenAI, 1536 dims) hoặc `text-embedding-004` (Gemini, 768 dims).

### Index

```sql
-- HNSW index cho approximate nearest neighbor (nhanh hơn IVFFlat cho đồ án)
CREATE INDEX idx_place_embeddings_hnsw
    ON place_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_knowledge_chunks_hnsw
    ON knowledge_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

**HNSW vs IVFFlat**: HNSW không cần training, tốt hơn khi data nhỏ-vừa (<1M rows). IVFFlat tốt hơn khi cần tiết kiệm RAM với data rất lớn.

### Semantic Search Query

```sql
-- Tìm places ngữ nghĩa tương tự query
SELECT
    p.id, p.name, p.rating_avg,
    1 - (pe.embedding <=> $query_vector) AS similarity
FROM place_embeddings pe
JOIN places p ON p.id = pe.place_id
WHERE
    p.status = 'ACTIVE'
    AND p.city = 'Đà Nẵng'
    AND 1 - (pe.embedding <=> $query_vector) > 0.7  -- threshold
ORDER BY pe.embedding <=> $query_vector ASC  -- cosine distance (nhỏ = gần hơn)
LIMIT 20;
```

### Embedding Pipeline

```
Trigger event:
  place INSERT / UPDATE (name, description, tags thay đổi)
         ↓
  Enqueue job: EMBEDDING_GEN vào BullMQ
         ↓
  Crawler Worker (embedding processor)
         ↓
  Build content text
         ↓
  Call Embedding API (batch nếu nhiều)
         ↓
  UPSERT place_embeddings
         ↓
  HNSW index auto-update
```

---

## 7. Crawler Architecture

### Nguyên tắc

```
API process:
  - Nhận request từ user/admin
  - Enqueue job vào Redis/BullMQ
  - Return ngay (202 Accepted)

Crawler Worker (process riêng):
  - Poll BullMQ queues
  - Chạy crawl job
  - Không có HTTP server
  - Có thể scale horizontally (nhiều worker)
```

### Crawler Worker Bootstrap

Crawler là **NestJS app không có HTTP server**. Nó chỉ khởi động BullMQ processors và lắng nghe queue.

```typescript
// apps/crawler/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // KHÔNG gọi app.listen() — không có HTTP server
  await app.init();
  logger.log('Crawler Worker started, listening for jobs...');
}
```

### Job Types & Queues

```
Queues:
  crawl-region   → RegionCrawlProcessor   (priority 3)
  crawl-place    → PlaceSyncProcessor     (priority 5)
  embed-places   → EmbeddingProcessor     (priority 7)

Job flow:
  REGION_CRAWL → tạo nhiều PLACE_SYNC jobs
  PLACE_SYNC   → sau khi save → tạo EMBEDDING_GEN job
```

### Crawler State Machine

```
PENDING → RUNNING → COMPLETED
              ↓
           FAILED → retry (exponential backoff)
              ↓ (max retries)
           DEAD (dead-letter)
```

---

## 8. Provider Architecture

### Interface

```typescript
// packages/shared-types/src/crawler.types.ts

interface RawPlace {
    externalId: string;
    name: string;
    description?: string;
    categoryHints: string[];     // ['restaurant', 'vietnamese food']
    address: string;
    latitude: number;
    longitude: number;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    priceLevel?: number;          // 1-4 (Google style)
    openingHours?: any;
    images?: RawImage[];
    rawData: Record<string, any>; // Original response để lưu vào place_sources
}

interface PlaceDataProvider {
    readonly providerName: string;

    searchPlaces(params: SearchPlacesParams): Promise<RawPlace[]>;
    getPlaceDetails(externalId: string): Promise<RawPlace>;
    searchByBoundingBox(bbox: BoundingBox, category?: string): Promise<RawPlace[]>;
}

interface SearchPlacesParams {
    query?: string;
    city?: string;
    bbox?: BoundingBox;
    category?: string;
    pageToken?: string;  // For pagination/cursor
    limit?: number;
}
```

### Strategy Pattern

```typescript
// apps/crawler/src/providers/provider.factory.ts
@Injectable()
export class ProviderFactory {
    private providers = new Map<string, PlaceDataProvider>();

    constructor(
        private osmProvider: OSMProvider,
        private googleProvider: GooglePlacesProvider,
    ) {
        this.providers.set('osm', osmProvider);
        this.providers.set('google_places', googleProvider);
    }

    getProvider(name: string): PlaceDataProvider {
        const provider = this.providers.get(name);
        if (!provider) throw new Error(`Provider ${name} not found`);
        return provider;
    }

    getAll(): PlaceDataProvider[] {
        return [...this.providers.values()];
    }
}
```

### Providers và Terms of Service

| Provider | API | Free Tier | Giới hạn lưu trữ | Phù hợp |
|----------|-----|-----------|-----------------|---------|
| **OpenStreetMap (Overpass API)** | Free, open | Unlimited | ODbL license — phải attribute | Places, coords, categories ✅ |
| **Google Places API (New)** | Paid | \$200/month credit | Không lưu vĩnh viễn rating/reviews | Place details, photos ⚠️ |
| **OpenRouteService** | Free tier | 2000 req/day | OK | Routing, geocoding ✅ |
| **Nominatim** | Free | Rate limited | Open data | Geocoding, reverse geocoding ✅ |

**Ưu tiên cho đồ án**: OSM + Nominatim (free, no ToS issues) + Google Places (limited, chỉ dùng cho enrichment).

---

## 9. Data Ingestion Pipeline

```
External Provider
       │
       ▼
  RawPlace[]
       │
       ▼ ── Normalizer ──────────────────────────────────
       │    - Map fields về NormalizedPlace canonical model
       │    - Resolve category slug
       │    - Parse opening hours → standard format
       │    - Parse price → { min, max, currency, level }
       │    - Validate lat/lng range (Vietnam bounds)
       │    - Clean address strings
       ▼
  NormalizedPlace
       │
       ▼ ── Validator ───────────────────────────────────
       │    - Require: name, latitude, longitude, address
       │    - lat: 8.0..23.5, lng: 102.0..110.0 (Vietnam)
       │    - name length > 2
       │    - rating: 0..5
       ▼
  ValidatedPlace
       │
       ▼ ── Deduplicator ────────────────────────────────
       │    - Check external_id trong place_sources
       │    - If match → update existing place
       │    - If no match → fuzzy check name + coords
       │    - If similar → candidate duplicate → flag
       │    - If new → proceed to insert
       ▼
  Action: INSERT | UPDATE | SKIP
       │
       ▼ ── Enricher ────────────────────────────────────
       │    - Geocode address nếu thiếu coords
       │    - Resolve area_id từ coords (ST_Within)
       │    - Normalize category → category_id
       │    - Set price_level từ price_range
       ▼
  Transaction: Upsert places + place_sources
       │
       ▼
  Update data_coverage
       │
       ▼
  Enqueue EMBEDDING_GEN job
       │
       ▼
  EmbeddingProcessor:
    - Build content text
    - Call Embedding API (batch 100 items)
    - UPSERT place_embeddings
```

---

## 10. Deduplication Strategy

### Layers of Deduplication

**Layer 1 — External ID Check** (fastest, O(1)):
```sql
SELECT place_id FROM place_sources
WHERE provider = $provider AND external_id = $external_id;
```
Nếu tìm thấy → đây là update, không phải duplicate.

**Layer 2 — Coordinate Proximity** (spatial, O(log n) với index):
```sql
SELECT p.id, p.name
FROM places p
WHERE ST_DWithin(
    p.location,
    ST_MakePoint($lng, $lat)::geography,
    50  -- 50 meters
)
AND p.status != 'DUPLICATE';
```
Nếu có place trong 50m → candidate duplicate.

**Layer 3 — Name Fuzzy Match** (pg_trgm):
```sql
SELECT id, name, similarity(name_normalized, $normalized_name) AS sim
FROM places
WHERE similarity(name_normalized, $normalized_name) > 0.7
LIMIT 5;
```

**Layer 4 — Combined Score**:
```typescript
function calculateDuplicateScore(candidate: Place, incoming: NormalizedPlace): number {
    const distanceScore = 1 - (distance_meters / 100);  // 0..1
    const nameScore = trigramSimilarity(candidate.name, incoming.name); // 0..1
    const addressScore = addressSimilarity(candidate.address, incoming.address); // 0..1

    // Weighted combination
    return distanceScore * 0.5 + nameScore * 0.35 + addressScore * 0.15;
}
// score > 0.85 → auto-merge
// score 0.7..0.85 → flag for review
// score < 0.7 → new place
```

**Idempotency**: Mỗi crawl job chạy lại kết quả không thay đổi vì check external_id trước tiên.

---

## 11. Synchronization Strategy

### Source Authority Matrix

| Field | Authoritative Source | Update Condition |
|-------|---------------------|-----------------|
| `name` | First source (manual priority) | Chỉ update nếu admin approve |
| `description` | Longest/most complete | Update nếu mới dài hơn 20% |
| `latitude/longitude` | Giữ nguyên sau lần đầu | Chỉ update nếu delta < 10m |
| `rating_avg` | Tính từ internal reviews | External rating lưu trong `place_sources` |
| `price_range` | Latest source | Update nếu thay đổi >10% |
| `opening_hours` | Latest source | Update nếu thay đổi |
| `phone/website` | Latest source | Update nếu thay đổi |
| `status` | Internal business logic | Không overwrite từ external |

### Sync Flow

```typescript
async function syncPlace(existing: Place, fresh: NormalizedPlace, provider: string) {
    const updates: Partial<Place> = {};

    // Chỉ update fields thay đổi
    if (fresh.phone && fresh.phone !== existing.phone) {
        updates.phone = fresh.phone;
    }
    if (fresh.openingHours && !deepEqual(fresh.openingHours, existing.openingHours)) {
        updates.openingHours = fresh.openingHours;
    }
    // Rating chỉ lưu vào place_sources, không overwrite places.rating_avg
    await placeSourceRepo.update({ provider, externalId: fresh.externalId }, {
        sourceRating: fresh.rating,
        sourceReviewCount: fresh.reviewCount,
        lastSyncedAt: new Date(),
        syncStatus: 'OK',
    });

    if (Object.keys(updates).length > 0) {
        await placeRepo.update(existing.id, { ...updates, updatedAt: new Date() });
    }
}
```

### Periodic Sync Schedule

```
Hotels, Restaurants: sync mỗi 7 ngày (giá/giờ thay đổi thường xuyên)
Tourist Attractions: sync mỗi 30 ngày
Static landmarks: sync mỗi 90 ngày

Stale threshold trong data_coverage:
  city: 7 ngày
  province: 14 ngày
```

---

## 12. Recommendation Pipeline

```
User Query: "Tôi đi Đà Nẵng 3 ngày, ngân sách 3 triệu, thích biển, ăn uống và chụp ảnh"
                │
                ▼
         ┌─────────────┐
         │ LLM Parser  │  (Gemini/OpenAI)
         └──────┬──────┘
                │ Structured Output:
                │ {
                │   city: "Đà Nẵng",
                │   days: 3,
                │   budget: 3000000,
                │   preferences: ["beach", "food", "photography"],
                │   constraints: { maxTravelDistance: "close" }
                │ }
                ▼
         ┌─────────────────────────────────────┐
         │         Filter Pipeline             │
         │                                     │
         │  1. City filter    → SQL WHERE      │
         │  2. Status filter  → status=ACTIVE  │
         │  3. Budget filter  → price_level    │
         │  4. Category filter→ JOIN categories│
         └──────────────┬──────────────────────┘
                        │ Candidate set (~500-2000 places)
                        ▼
         ┌─────────────────────────────────────┐
         │      Semantic Search (pgvector)     │
         │                                     │
         │  Query: "biển chụp ảnh lãng mạn"   │
         │  → Embedding → Cosine similarity    │
         │  → Top K (100)                      │
         └──────────────┬──────────────────────┘
                        │ Filtered candidates
                        ▼
         ┌─────────────────────────────────────┐
         │         Scoring & Ranking           │
         │                                     │
         │  final_score = Σ(score_i × weight_i)│
         └──────────────┬──────────────────────┘
                        │ Ranked places
                        ▼
         ┌─────────────────────────────────────┐
         │      Spatial Clustering (PostGIS)   │
         │  ST_ClusterDBSCAN → clusters        │
         └──────────────┬──────────────────────┘
                        │
                        ▼
         ┌─────────────────────────────────────┐
         │      Route Optimization             │
         │  Per cluster → routing matrix       │
         │  → greedy TSP heuristic             │
         └──────────────┬──────────────────────┘
                        │
                        ▼
               Itinerary Generation
```

---

## 13. Ranking Algorithm

### Scoring Function

```
final_score = Σ(normalized_score_i × weight_i)

Components:
  semantic_score   × 0.30  ← pgvector cosine similarity
  rating_score     × 0.25  ← normalized rating
  distance_score   × 0.20  ← proximity to user/hotel
  price_score      × 0.15  ← budget fit
  preference_score × 0.10  ← match với user_preferences
```

### Normalization

```typescript
// Rating: 0..5 → 0..1
rating_score = (rating_avg - 1) / 4;

// Distance: 0..maxRadius → 1..0 (gần hơn = score cao hơn)
distance_score = 1 - (distance_m / max_radius_m);

// Price: fit với budget level → 1.0, 1 level lệch → 0.7, 2+ levels → 0.3
price_score = budget_match_score(place.price_level, user.budget_level);

// Semantic: cosine similarity đã là 0..1

// Preference: số categories match / tổng preferences
preference_score = matching_categories / user_preferences.length;
```

### Configurable Weights

Weights có thể override qua request:

```json
{
  "scoringWeights": {
    "semantic": 0.4,
    "rating": 0.3,
    "distance": 0.1,
    "price": 0.1,
    "preference": 0.1
  }
}
```

Default weights lưu trong config file, không hard-code.

### Diversity Boost

Sau ranking, áp dụng **diversity penalty** để tránh recommending 5 nhà hàng liên tiếp:

```typescript
// Max 2 places cùng category trong top 10
applyDiversityPenalty(candidates, maxPerCategory: 2);
```

---

## 14. Clustering Strategy

### Tại sao cần Clustering?

Không cluster → user đi từ Bắc Đà Nẵng xuống Nam Đà Nẵng rồi lại lên Bắc → lãng phí thời gian. Cluster giúp gom các địa điểm gần nhau vào một "khu vực" để visit cùng ngày.

### DBSCAN vs KMeans

| | DBSCAN | KMeans |
|--|--------|--------|
| Số cluster | Tự động | Phải chỉ định trước |
| Shape | Arbitrary | Convex |
| Noise/outlier | Detect được | Không |
| Dùng khi | Clusters tự nhiên, outliers | Muốn đúng N clusters |

**Chọn**: DBSCAN cho recommendation (clusters tự nhiên), KMeans khi cần đúng `num_days` clusters cho itinerary.

### Itinerary Clustering Flow

```typescript
// 1. Cluster candidates bằng DBSCAN
const clusters = await runDBSCAN(candidates, eps=0.008, minPoints=2);
// eps = 0.008 degrees ≈ 880m

// 2. Nếu số clusters < num_days: merge clusters nhỏ
// 3. Nếu số clusters > num_days: assign clusters theo ngày (top clusters by score)
// 4. Outlier places (cluster_id = -1): assign vào cluster gần nhất

// 5. Assign clusters → days
// Day 1: Cluster A (Bãi biển Mỹ Khê + Non Nước)
// Day 2: Cluster B (Trung tâm + Cầu Rồng + Hội An nearby)
// Day 3: Cluster C (Sơn Trà + Bán đảo)
```

---

## 15. Routing Strategy

### Phân biệt rõ ràng

| | PostGIS | Routing Engine |
|--|---------|----------------|
| Tính cái gì | Crow-fly distance | Road distance + duration |
| Dùng road network | Không | Có |
| Độ chính xác | Thấp (không tính đường) | Cao |
| Tốc độ | Rất nhanh (index) | Chậm hơn |
| Dùng cho | Nearby search, clustering | Itinerary timing |

### Routing Provider cho đồ án

**OpenRouteService (ORS)** — free tier 2000 req/day, đủ cho demo.

Endpoints cần:
```
POST /v2/directions/driving-car
Body: { coordinates: [[lng1,lat1], [lng2,lat2]] }

POST /v2/matrix/driving-car
Body: { locations: [...], metrics: ["duration", "distance"] }
```

### Route Matrix cho N places

```
N places trong một cluster:
  → Matrix API: N×N distances + durations
  → dùng cho TSP heuristic

Ví dụ Cluster A có 5 places:
  Matrix 5×5 = 25 pairs
  → Nearest Neighbor heuristic từ hotel → P1 → P2 → P3 → P4 → P5
  → 2-opt improvement (swap pairs để reduce total duration)
```

### Route Optimization Algorithm

```typescript
function optimizeRoute(places: Place[], startPoint: LatLng, matrix: DistanceMatrix): Place[] {
    // 1. Nearest Neighbor Heuristic (O(n²))
    let route = nearestNeighborTSP(startPoint, places, matrix);

    // 2. 2-opt local search improvement
    route = twoOptImprove(route, matrix);

    // 3. Filter theo opening hours
    route = filterByOpeningHours(route, dayStartTime);

    // 4. Check budget constraint
    route = filterByBudget(route, remainingBudget);

    return route;
}
```

---

## 16. Itinerary Algorithm

### Full Algorithm

```typescript
async function generateItinerary(request: ItineraryRequest): Promise<Itinerary> {

    // STEP 1: Parse user intent
    const preferences = await llm.extractPreferences(request.prompt);
    // → { city, days, budget, categories, constraints }

    // STEP 2: Check data coverage
    const coverage = await checkDataCoverage(preferences.city);
    if (coverage.status === 'NOT_COVERED' || coverage.placeCount < 20) {
        await enqueueRegionCrawl(preferences.city);
        // Return 202 với polling endpoint
    }

    // STEP 3: Candidate selection (SQL + PostGIS + pgvector)
    const candidates = await hybridSearch({
        city: preferences.city,
        categories: preferences.categories,
        priceLevel: preferences.budgetLevel,
        semanticQuery: preferences.rawQuery,
        limit: 200,
    });

    // STEP 4: Scoring & Ranking
    const scored = scoreAndRank(candidates, preferences);

    // STEP 5: Spatial clustering → assign to days
    const dayCount = preferences.days;
    const clusters = await clusterByDay(scored, dayCount);

    // STEP 6: Per-day route optimization
    const days: ItineraryDay[] = [];
    const hotelLocation = preferences.hotelLocation ?? getCityCenter(preferences.city);
    let remainingBudget = preferences.budget;

    for (let dayNum = 1; dayNum <= dayCount; dayNum++) {
        const dayPlaces = clusters[dayNum - 1];

        // Route optimization trong cluster
        const routingMatrix = await routingEngine.getMatrix(dayPlaces);
        const optimizedRoute = optimizeRoute(dayPlaces, hotelLocation, routingMatrix);

        // Schedule với timing
        const scheduled = schedulePlaces(optimizedRoute, {
            dayStart: '08:00',
            mealBreaks: ['12:00', '18:00'],
            visitDuration: estimateVisitDuration, // theo category
        });

        // Budget tracking
        const dayCost = estimateDayCost(scheduled, preferences);
        remainingBudget -= dayCost;

        days.push({
            dayNumber: dayNum,
            items: scheduled,
            estimatedCost: dayCost,
        });
    }

    // STEP 7: AI generates narrative
    const narrative = await llm.generateItineraryNarrative(days, preferences);

    // STEP 8: Save to database
    return saveItinerary({ preferences, days, narrative });
}
```

### Visit Duration Estimation

```typescript
const DEFAULT_VISIT_DURATIONS: Record<string, number> = {
    'restaurant': 75,      // 75 phút
    'cafe': 60,
    'museum': 120,
    'beach': 180,
    'park': 90,
    'landmark': 45,
    'shopping': 90,
    'entertainment': 120,
    'hotel': 15,           // Chỉ check-in
};
```

---

## 17. AI Agent Architecture

### Tại sao Agentic AI?

Tool Calling = AI Agent quyết định **khi nào** gọi tool nào, không cần prompt engineering cứng nhắc. User có thể nói tự nhiên và agent tự plan các bước.

### Agent Tools

```typescript
const AGENT_TOOLS = [
    {
        name: 'searchPlaces',
        description: 'Tìm kiếm địa điểm theo query text, city, category',
        parameters: { query, city, category, limit }
    },
    {
        name: 'searchNearbyPlaces',
        description: 'Tìm địa điểm gần một vị trí (lat/lng hoặc place_id)',
        parameters: { latitude, longitude, radiusMeters, category, limit }
    },
    {
        name: 'filterPlacesByPrice',
        description: 'Lọc địa điểm theo budget level hoặc price range',
        parameters: { places, maxPrice, budgetLevel }
    },
    {
        name: 'filterPlacesByRating',
        description: 'Lọc địa điểm theo minimum rating',
        parameters: { places, minRating }
    },
    {
        name: 'getPlaceDetails',
        description: 'Lấy chi tiết một địa điểm theo ID',
        parameters: { placeId }
    },
    {
        name: 'getUserPreferences',
        description: 'Lấy preferences đã lưu của user hiện tại',
        parameters: {}
    },
    {
        name: 'getUserItinerary',
        description: 'Lấy itinerary của user',
        parameters: { itineraryId }
    },
    {
        name: 'calculateRoute',
        description: 'Tính route và thời gian di chuyển giữa các điểm',
        parameters: { origin, destination, mode }
    },
    {
        name: 'createItinerary',
        description: 'Tạo itinerary mới từ danh sách places',
        parameters: { title, places, startDate, endDate, budget }
    },
    {
        name: 'modifyItinerary',
        description: 'Thêm/xóa/sắp xếp lại places trong itinerary',
        parameters: { itineraryId, action, placeId, dayNumber, position }
    },
    {
        name: 'searchKnowledgeBase',
        description: 'Tìm kiếm thông tin từ knowledge base (travel guides, FAQ)',
        parameters: { query, areaSlug }
    },
];
```

### Agent Loop

```
User message
      │
      ▼
  Build prompt:
    - System prompt
    - Conversation history (compressed)
    - Tool definitions
    - RAG context (relevant chunks)
      │
      ▼
  LLM call (streaming)
      │
      ▼
  Tool call detected?
      ├── YES:
      │     Execute tool (backend deterministic logic)
      │     → Append tool result to context
      │     → Loop back to LLM
      │
      └── NO:
            Final response → stream to user (SSE)
```

### LLM Abstraction

```typescript
interface LLMProvider {
    chat(messages: ChatMessage[], tools?: Tool[]): Promise<ChatResponse>;
    streamChat(messages: ChatMessage[], tools?: Tool[]): AsyncIterable<ChatChunk>;
    embed(texts: string[]): Promise<number[][]>;
}

// Implementations:
class GeminiProvider implements LLMProvider { ... }
class OpenAIProvider implements LLMProvider { ... }

// Factory:
@Injectable()
class LLMFactory {
    create(provider: 'gemini' | 'openai'): LLMProvider { ... }
}
```

---

## 18. RAG Architecture

### Pipeline

```
INGESTION:
  Document (PDF/text/web)
       │
       ▼
  Chunker (size: 500 tokens, overlap: 50 tokens)
       │
       ▼
  Chunk[]
       │
       ▼
  Embed each chunk (batch)
       │
       ▼
  INSERT knowledge_chunks (content, embedding, metadata)


RETRIEVAL (per query):
  User question: "Tôi có cần visa khi đến Đà Nẵng không?"
       │
       ▼
  Embed query
       │
       ▼
  pgvector similarity search:
    SELECT content FROM knowledge_chunks
    WHERE metadata->>'area' = 'da-nang'
    ORDER BY embedding <=> $query_vec
    LIMIT 5
       │
       ▼
  Top 5 relevant chunks
       │
       ▼
  Build context:
    "Dựa trên tài liệu sau: [chunk1] [chunk2]...
     Trả lời câu hỏi: ..."
       │
       ▼
  LLM generates answer
```

### Chunking Strategy

- **Chunk size**: 400–600 tokens
- **Overlap**: 50 tokens (tránh mất context ở ranh giới)
- **Splitter**: Sentence boundary aware (không cắt giữa câu)
- **Metadata**: area, topic, source, language

---

## 19. Redis / BullMQ Architecture

### Redis Usage Map

```
Key Pattern                    | TTL      | Mục đích
─────────────────────────────────────────────────────────
place:detail:{id}              | 30 min   | Place details cache
places:nearby:{lat}:{lng}:{r}  | 10 min   | Nearby search cache
places:search:{hash}           | 15 min   | Search result cache
rec:city:{city}:{hash}         | 5 min    | Recommendation cache
rate-limit:api:{ip}            | 1 min    | Rate limiting (sliding window)
rate-limit:ext:{provider}:{ip} | 1 sec    | External API rate limiting
crawl:lock:{jobId}             | 10 min   | Distributed lock (prevent duplicate runs)
session:{userId}               | 24 hr    | Auth session (nếu dùng session-based)
otp:{email}                    | 10 min   | OTP verification
```

### BullMQ Queues

```typescript
const QUEUES = {
    REGION_CRAWL: {
        name: 'crawl-region',
        concurrency: 2,     // Max 2 region crawls đồng thời
        limiter: { max: 10, duration: 60000 },  // 10 jobs/phút
    },
    PLACE_SYNC: {
        name: 'crawl-place',
        concurrency: 5,
        limiter: { max: 50, duration: 60000 },
    },
    EMBEDDING: {
        name: 'embed-places',
        concurrency: 3,
        limiter: { max: 30, duration: 60000 },  // Giới hạn embedding API calls
    },
};
```

### Retry Strategy

```typescript
// Exponential backoff: 1s, 2s, 4s, 8s, 16s
const retryOptions = {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
};

// Dead-letter: sau max retries, move đến queue 'failed-jobs'
// Admin có thể retry thủ công từ failed-jobs queue
```

---

## 20. API Design

### REST API Endpoints

```
AUTH
  POST   /auth/register
  POST   /auth/login
  POST   /auth/refresh
  POST   /auth/logout
  POST   /auth/google          # OAuth2 callback
  POST   /auth/verify-otp

USERS
  GET    /users/me
  PATCH  /users/me
  GET    /users/me/preferences
  PUT    /users/me/preferences

PLACES
  GET    /places                # List với filters: city, category, priceLevel, rating, status
  GET    /places/:id            # Detail
  GET    /places/nearby         # ?lat=&lng=&radius=&category=&limit=
  GET    /places/search         # ?q=&city=&category=&minRating=&maxPrice=&page=
  POST   /places                # [ADMIN] Create
  PATCH  /places/:id            # [ADMIN] Update
  DELETE /places/:id            # [ADMIN] Delete

  GET    /places/:id/reviews
  POST   /places/:id/reviews    # [AUTH] Submit review
  DELETE /reviews/:id           # [AUTH] Delete own review

CATEGORIES
  GET    /categories            # Full list với hierarchy
  GET    /categories/:slug

COLLECTIONS
  GET    /collections           # User's own collections
  POST   /collections
  GET    /collections/:id
  PATCH  /collections/:id
  DELETE /collections/:id
  POST   /collections/:id/places       # Add place
  DELETE /collections/:id/places/:pid  # Remove place

RECOMMENDATIONS
  POST   /recommendations       # Hybrid search + ranking
  # Body: { query, city, categories, budget, location, filters }
  # Returns: ranked places + metadata

ITINERARIES
  GET    /itineraries           # User's itineraries
  POST   /itineraries           # Create manually
  GET    /itineraries/:id
  PATCH  /itineraries/:id
  DELETE /itineraries/:id
  POST   /itineraries/generate  # AI-generated from prompt
  POST   /itineraries/:id/regenerate
  POST   /itineraries/:id/publish
  POST   /itineraries/:id/clone

  # Days & Items
  GET    /itineraries/:id/days
  PATCH  /itineraries/:id/days/:dayId
  POST   /itineraries/:id/days/:dayId/items
  DELETE /itineraries/:id/days/:dayId/items/:itemId
  PATCH  /itineraries/:id/days/:dayId/items/:itemId
  POST   /itineraries/:id/days/:dayId/items/reorder  # Drag & drop reorder

TRIP GROUPS
  POST   /trip-groups                  # Create from itinerary
  GET    /trip-groups/:id
  POST   /trip-groups/join             # Body: { inviteCode }
  POST   /trip-groups/:id/proposals    # Propose place
  POST   /trip-groups/:id/proposals/:proposalId/vote
  DELETE /trip-groups/:id/proposals/:proposalId/vote

AI
  POST   /ai/chat              # SSE stream
  GET    /ai/sessions          # User's chat sessions
  GET    /ai/sessions/:id/messages
  DELETE /ai/sessions/:id

COMMUNITY
  GET    /community/posts      # Feed (cursor pagination)
  POST   /community/posts      # Publish itinerary as post
  GET    /community/posts/:id
  POST   /community/posts/:id/like
  DELETE /community/posts/:id/like
  GET    /community/posts/:id/comments
  POST   /community/posts/:id/comments

ADMIN
  # Crawler Management
  POST   /admin/crawler/jobs              # Trigger crawl job
  GET    /admin/crawler/jobs             # List jobs
  GET    /admin/crawler/jobs/:id         # Job detail + progress
  POST   /admin/crawler/jobs/:id/retry   # Retry failed job
  POST   /admin/crawler/jobs/:id/cancel  # Cancel running job
  GET    /admin/data-coverage            # Coverage per city

  # Knowledge Base
  POST   /admin/knowledge/documents
  POST   /admin/knowledge/documents/:id/process  # Trigger chunking + embedding
  DELETE /admin/knowledge/documents/:id

  # Users
  GET    /admin/users
  PATCH  /admin/users/:id/status  # Activate/deactivate

HEALTH
  GET    /health               # Liveness probe
  GET    /health/ready         # Readiness probe (DB, Redis connected)
```

### Response Format

```typescript
// Success
{
  "data": { ... } | [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasNextPage": true
  }
}

// Cursor pagination (community feed)
{
  "data": [...],
  "meta": {
    "nextCursor": "2024-01-15T10:30:00Z",
    "hasMore": true
  }
}

// Error
{
  "error": {
    "code": "PLACE_NOT_FOUND",
    "message": "Địa điểm không tồn tại",
    "statusCode": 404
  }
}

// Async job (crawl triggered)
{
  "data": {
    "jobId": "uuid",
    "status": "PENDING",
    "pollUrl": "/admin/crawler/jobs/uuid"
  }
}
```

---

## 21. NestJS Module Structure

### API App

```
apps/api/src/
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── google.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── dto/
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── dto/
│   │
│   ├── places/
│   │   ├── places.module.ts
│   │   ├── places.controller.ts
│   │   ├── places.service.ts
│   │   ├── places.repository.ts  # Raw SQL cho PostGIS queries
│   │   ├── reviews/
│   │   └── dto/
│   │
│   ├── categories/
│   │
│   ├── collections/
│   │
│   ├── recommendations/
│   │   ├── recommendations.module.ts
│   │   ├── recommendations.controller.ts
│   │   ├── recommendations.service.ts    # Orchestration
│   │   ├── hybrid-search.service.ts      # SQL + pgvector query
│   │   ├── scoring.service.ts            # Scoring function
│   │   └── dto/
│   │
│   ├── itineraries/
│   │   ├── itineraries.module.ts
│   │   ├── itineraries.controller.ts
│   │   ├── itineraries.service.ts
│   │   ├── itinerary-generator.service.ts  # Core algorithm
│   │   ├── budget-calculator.service.ts
│   │   ├── scheduler.service.ts            # Timing/opening hours
│   │   └── dto/
│   │
│   ├── routing/
│   │   ├── routing.module.ts
│   │   ├── routing.service.ts            # Abstraction
│   │   └── providers/
│   │       └── ors.provider.ts           # OpenRouteService
│   │
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai.controller.ts              # SSE endpoint
│   │   ├── agent.service.ts              # Agentic loop
│   │   ├── tools/
│   │   │   ├── search-places.tool.ts
│   │   │   ├── get-place-details.tool.ts
│   │   │   ├── calculate-route.tool.ts
│   │   │   ├── create-itinerary.tool.ts
│   │   │   └── search-knowledge.tool.ts
│   │   ├── memory/
│   │   │   └── conversation-memory.service.ts
│   │   └── llm/
│   │       ├── llm.interface.ts
│   │       ├── gemini.provider.ts
│   │       ├── openai.provider.ts
│   │       └── llm.factory.ts
│   │
│   ├── rag/
│   │   ├── rag.module.ts
│   │   ├── rag.service.ts               # Retrieval + augmentation
│   │   ├── chunker.service.ts
│   │   └── embedding.service.ts         # Shared với crawler
│   │
│   ├── crawler-admin/
│   │   ├── crawler-admin.module.ts
│   │   ├── crawler-admin.controller.ts  # [ADMIN] endpoints
│   │   └── crawler-admin.service.ts     # Enqueue jobs
│   │
│   ├── community/
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
│
├── common/
│   ├── guards/
│   ├── interceptors/
│   │   ├── response-transform.interceptor.ts
│   │   └── logging.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       └── roles.decorator.ts
│
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── llm.config.ts
│   └── app.config.ts
│
└── main.ts
```

### Crawler App

```
apps/crawler/src/
│
├── providers/
│   ├── base.provider.ts              # Abstract class với retry/backoff
│   ├── osm/
│   │   ├── osm.provider.ts           # Overpass API implementation
│   │   ├── osm.transformer.ts        # OSM tags → NormalizedPlace
│   │   └── osm.constants.ts          # Category tag mappings
│   ├── google/
│   │   ├── google.provider.ts        # Google Places API v1
│   │   └── google.transformer.ts
│   └── provider.factory.ts
│
├── processors/
│   ├── region-crawl.processor.ts     # @Processor('crawl-region')
│   ├── place-sync.processor.ts       # @Processor('crawl-place')
│   └── embedding.processor.ts        # @Processor('embed-places')
│
├── services/
│   ├── normalizer.service.ts
│   ├── validator.service.ts
│   ├── deduplicator.service.ts
│   ├── enricher.service.ts           # area_id resolution, category mapping
│   └── data-coverage.service.ts
│
├── repositories/
│   ├── place.repository.ts           # Crawler-specific DB operations
│   └── crawl-job.repository.ts
│
├── config/
│   └── crawler.config.ts
│
└── main.ts                           # NestJS init, NO app.listen()
```

### ORM: TypeORM

**Lý do chọn TypeORM** thay vì Prisma hay Drizzle:
- Native NestJS integration (`@nestjs/typeorm`)
- Hỗ trợ `@Column({ type: 'geography' })` với custom transformer
- Raw query support tốt khi cần PostGIS functions phức tạp
- Migration system mature

**Với PostGIS và pgvector**: Dùng TypeORM cho standard CRUD, dùng **raw SQL** ở Repository layer cho spatial queries và vector similarity.

```typescript
// places.repository.ts
async findNearby(lat: number, lng: number, radiusM: number): Promise<Place[]> {
    return this.dataSource.query(`
        SELECT p.*, ST_Distance(p.location, ST_MakePoint($1, $2)::geography) as distance_m
        FROM places p
        WHERE ST_DWithin(p.location, ST_MakePoint($1, $2)::geography, $3)
          AND p.status = 'ACTIVE'
        ORDER BY distance_m ASC
        LIMIT 20
    `, [lng, lat, radiusM]);
}
```

---

## 22. Deployment Architecture

### Docker Compose (Development)

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: tripgenie
      POSTGRES_PASSWORD: secret
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  osrm:  # Hoặc dùng ORS cloud API
    image: osrm/osrm-backend
    # Chỉ enable khi test routing locally

  api:
    build: ./apps/api
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379

  crawler:
    build: ./apps/crawler
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379
      OSM_API_URL: https://overpass-api.de/api
      GOOGLE_PLACES_API_KEY: ${GOOGLE_PLACES_API_KEY}

volumes:
  pgdata:
```

### Production Architecture

```
Internet
    │
    ▼
[Nginx / Reverse Proxy]
    │
    ▼
[API Container]          [Crawler Worker Container]
    │                               │
    └───────────┬───────────────────┘
                ▼
        [PostgreSQL + PostGIS + pgvector]
        [Redis]
        [ORS Cloud API]
        [LLM API (Gemini/OpenAI)]
```

**Containers riêng biệt**: API và Crawler deploy thành container riêng — có thể scale crawler independently mà không ảnh hưởng API.

---

## 23. Security

### API Keys

```
.env (never commit):
  DATABASE_URL=postgresql://...
  REDIS_URL=redis://...
  GOOGLE_PLACES_API_KEY=...
  GEMINI_API_KEY=...
  JWT_SECRET=...
  JWT_REFRESH_SECRET=...
```

### Security Controls

| Concern | Solution |
|---------|----------|
| Authentication | JWT (access token 15m + refresh token 7d) |
| Authorization | Role-based guards (`@Roles('ADMIN')`) |
| Rate Limiting | `@nestjs/throttler` + Redis sliding window |
| SQL Injection | TypeORM parameterized queries, raw SQL dùng `$1, $2` params |
| Input Validation | `class-validator` + `ValidationPipe` (whitelist, forbidNonWhitelisted) |
| External API timeout | `axios-retry` + timeout 10s trên mọi external call |
| SSRF (crawler) | Whitelist allowed domains cho crawler fetches |
| Sensitive data logging | Không log `password_hash`, `api_key`, JWT payload |
| Admin endpoints | `@Roles('ADMIN')` guard trên tất cả `/admin/*` |
| CORS | Whitelist frontend origin |

---

## 24. Performance

### Database Indexes (summary)

```sql
-- Places
CREATE INDEX idx_places_location      ON places USING GIST (location);
CREATE INDEX idx_places_status        ON places (status) WHERE status = 'ACTIVE';
CREATE INDEX idx_places_city_status   ON places (city, status);
CREATE INDEX idx_places_category      ON places (category_id);
CREATE INDEX idx_places_rating        ON places (rating_avg DESC);
CREATE INDEX idx_places_name_trgm     ON places USING GIN (name_normalized gin_trgm_ops);

-- Embeddings
CREATE INDEX idx_place_embeddings_hnsw ON place_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_chunks_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- Itineraries
CREATE INDEX idx_itinerary_days_order ON itinerary_days (itinerary_id, day_number);
CREATE INDEX idx_itinerary_items_order ON itinerary_items (day_id, visit_order);

-- Community feed (cursor pagination)
CREATE INDEX idx_community_posts_cursor ON community_posts (created_at DESC, id DESC);
```

### Caching Strategy

```
Place detail: 30 min TTL (thay đổi thỉnh thoảng)
Nearby search: 10 min TTL + invalidate khi place update
Recommendation: 5 min TTL
Categories: 1 hour TTL (ít thay đổi)
Data coverage: 1 hour TTL
```

### Batching

- **Embedding generation**: batch 100 places/call (giảm API calls)
- **Crawler**: fetch 20 places/page, process batch trước khi commit transaction
- **Route matrix**: request một lần cho cả cluster, không gọi từng pair

### Connection Pool

```typescript
// TypeORM DataSource
{
    extra: {
        max: 10,        // Max connections trong pool
        min: 2,
        idleTimeoutMillis: 30000,
    }
}
```

---

## 25. Testing

### Unit Tests

```
normalizer.service.spec.ts    → Test OSM tags → NormalizedPlace
deduplicator.service.spec.ts  → Test duplicate detection logic
scoring.service.spec.ts        → Test scoring function với mock data
budget-calculator.service.spec.ts → Test budget estimation
itinerary-generator.service.spec.ts → Test routing optimization logic
```

### Integration Tests

```
places.repository.spec.ts     → Testcontainers PostgreSQL + PostGIS
                                  ST_DWithin, ST_Distance
embedding.service.spec.ts     → pgvector similarity search
redis.service.spec.ts         → Cache get/set/invalidate
bullmq.processor.spec.ts      → Job processing
```

### E2E Tests

```
POST /recommendations          → Hybrid search returns ranked places
POST /itineraries/generate     → Full pipeline từ prompt đến itinerary
POST /ai/chat                  → SSE stream với tool calling
```

### Test Stack

- **Unit**: Jest + ts-jest
- **Integration**: Testcontainers (PostgreSQL + Redis)
- **E2E**: Supertest + Jest

---

## 26. Implementation Roadmap

### PHASE 1 — Foundation (1-2 tuần)
- [ ] Monorepo setup (pnpm workspace + Turborepo)
- [ ] Docker Compose (PostgreSQL + PostGIS + pgvector + Redis)
- [ ] Database migrations: extensions, enums, core tables
- [ ] packages/database, packages/shared-types, packages/common
- [ ] NestJS API scaffold với auth module
- [ ] JWT authentication

### PHASE 2 — Crawler Foundation (1-2 tuần)
- [ ] Provider interface + OSM implementation
- [ ] Normalizer, Validator services
- [ ] BullMQ setup + basic processor
- [ ] Crawler Worker NestJS app (no HTTP)
- [ ] crawl_jobs table, data_coverage table

### PHASE 3 — Data Ingestion (1 tuần)
- [ ] Deduplication service (pg_trgm + spatial)
- [ ] place_sources sync tracking
- [ ] Admin API để trigger crawl jobs
- [ ] Crawl Hồ Chí Minh, Đà Nẵng, Hà Nội via OSM

### PHASE 4 — Place Search (1 tuần)
- [ ] places module: CRUD + PostGIS nearby search
- [ ] Search API với filters (city, category, price, rating)
- [ ] Bounding box search
- [ ] Place detail API

### PHASE 5 — Recommendation Engine (1 tuần)
- [ ] Embedding generation (sau crawl)
- [ ] pgvector semantic search
- [ ] Hybrid search service
- [ ] Scoring function
- [ ] Recommendation API

### PHASE 6 — Clustering + Routing (1 tuần)
- [ ] ST_ClusterDBSCAN integration
- [ ] OpenRouteService client
- [ ] Route matrix calculation
- [ ] TSP heuristic (nearest neighbor + 2-opt)

### PHASE 7 — Itinerary (1-2 tuần)
- [ ] Itinerary generator service
- [ ] Multi-day planning
- [ ] Opening hours constraint
- [ ] Budget tracking
- [ ] Itinerary CRUD API

### PHASE 8 — AI Agent (1-2 tuần)
- [ ] LLM provider abstraction (Gemini)
- [ ] Tool definitions
- [ ] Agentic loop
- [ ] SSE streaming
- [ ] Chat session + memory compression

### PHASE 9 — RAG (1 tuần)
- [ ] knowledge_documents + knowledge_chunks tables
- [ ] Chunker service
- [ ] Knowledge embedding
- [ ] RAG retrieval
- [ ] Integration vào AI Agent

### PHASE 10 — Community + Polish (1 tuần)
- [ ] Community posts + feed
- [ ] Trip groups + voting (WebSocket)
- [ ] Performance tuning
- [ ] Redis caching
- [ ] Logging + monitoring

### PHASE 11 — Testing + Deployment (1 tuần)
- [ ] Unit tests cho core services
- [ ] Integration tests
- [ ] E2E tests
- [ ] Docker Compose production config
- [ ] README + API documentation

---

> **Tổng thời gian ước tính**: 12–16 tuần cho một developer, phù hợp với quy mô đồ án tốt nghiệp.

> **Demo priority**: Phase 1–5 đủ để demo search + recommendation. Phase 6–9 là highlight của đồ án. Phase 10–11 là polish.

---

## 27. Mandatory Conventions (Application Layer)

Phần này document các **quy tắc bắt buộc ở tầng application** không thể enforce bằng DB schema, nhưng nếu vi phạm sẽ gây **silent data loss** hoặc **silent bug** — loại lỗi khó phát hiện nhất vì không có exception nào được ném ra.

> [!CAUTION]
> Các convention này PHẢI được enforce qua code review. Vi phạm không bị DB từ chối nhưng sẽ gây mất dữ liệu người dùng.

---

### 27.1 Field-Level Update (PATCH, không phải PUT)

**Vấn đề:** `itinerary_destinations` cho phép nhiều EDITOR sửa trực tiếp. Nếu application gửi full-object UPDATE, hai EDITOR sửa field khác nhau của cùng một row cùng lúc sẽ gây **silent data loss** — người sau ghi đè toàn bộ object, kể cả field người trước vừa sửa.

**Ví dụ lỗi:**
```
T=0ms  EDITOR A load row: { notes: "Ăn sáng", start_time: "08:00", visit_order: 1.0 }
T=0ms  EDITOR B load row: { notes: "Ăn sáng", start_time: "08:00", visit_order: 1.0 }
T=100ms EDITOR A sửa notes → "Ăn sáng sớm"
T=200ms EDITOR B sửa start_time → "09:00"
T=201ms EDITOR A save full object: SET notes="Ăn sáng sớm", start_time="08:00" ← ghi đè start_time của B
T=202ms EDITOR B save full object: SET notes="Ăn sáng", start_time="09:00"      ← ghi đè notes của A
Kết quả: notes = "Ăn sáng" (mất thay đổi của A), start_time = "09:00"
```

**Convention bắt buộc:**

```typescript
// ✅ ĐÚNG — Field-level PATCH
// API: PATCH /itinerary-destinations/:id
// Body: { "notes": "Ăn sáng sớm" }
await this.itineraryDestinationRepo.update(id, { notes: dto.notes });
// SQL: UPDATE itinerary_destinations SET notes = $1 WHERE id = $2

// ✅ ĐÚNG — Chỉ update field được gửi lên
async patchDestination(id: UUID, dto: PatchDestinationDto) {
    const updateData: Partial<ItineraryDestination> = {};
    if (dto.notes      !== undefined) updateData.notes      = dto.notes;
    if (dto.start_time !== undefined) updateData.start_time = dto.start_time;
    if (dto.visit_order!== undefined) updateData.visit_order= dto.visit_order;
    // Chỉ set field có trong dto, không bao giờ send full object
    await this.repo.update(id, updateData);
}

// ❌ SAI — Full object update
await this.repo.save(entity);  // TypeORM save() generate SET cho mọi field
// Dùng save() chỉ khi INSERT (new entity)
```

**API Design Rule:**
- `PATCH /itinerary-destinations/:id` → field-level update (convention này)
- `PUT /itinerary-destinations/:id` → KHÔNG expose endpoint này
- TypeORM: Dùng `update()`, không dùng `save()` cho existing entities

---

### 27.2 Soft-Delete Propagation (Repository Layer Responsibility)

**Vấn đề:** `places.deleted_at` là soft-delete. Khi admin soft-delete một place, FK references trong các bảng con (`place_reviews`, `itinerary_destinations`, `collection_places`) **không tự phản ánh** vì FK CASCADE vật lý không kích hoạt với soft-delete.

**Hệ quả nếu bỏ qua:** Place đã xóa vẫn hiện trong lịch trình của user, trong collection, trong feed — gây UX tệ và lộ dữ liệu nội bộ.

**Convention bắt buộc:**

```typescript
// ✅ ĐÚNG — Luôn query từ active_places view hoặc có WHERE clause
// Tất cả PlaceRepository methods mặc định filter soft-deleted

@Injectable()
export class PlaceRepository {
    // BASE query — dùng cho mọi user-facing endpoint
    private baseQuery() {
        return this.repo
            .createQueryBuilder('place')
            .where('place.deleted_at IS NULL')
            .andWhere("place.status != 'DUPLICATE'");
    }

    findById(id: UUID) {
        return this.baseQuery().andWhere('place.id = :id', { id }).getOne();
    }

    // ADMIN endpoint — explicit opt-in để xem deleted
    findByIdIncludeDeleted(id: UUID) {
        return this.repo.findOne({ where: { id } }); // không filter
    }
}

// ✅ ĐÚNG — Khi JOIN places từ bảng khác
const destinations = await this.repo
    .createQueryBuilder('dest')
    .innerJoin('dest.place', 'place', 'place.deleted_at IS NULL') // ← bắt buộc
    .where('dest.itinerary_id = :id', { id })
    .getMany();

// ❌ SAI — Query place trực tiếp không filter
const place = await this.placeRepo.findOne({ where: { id } });
// → có thể trả về place đã bị admin soft-delete
```

**Rule of thumb:**
- Mọi `PlaceRepository` method → default có `deleted_at IS NULL`
- Mọi JOIN với `places` table → thêm `AND places.deleted_at IS NULL`
- ADMIN endpoints muốn xem deleted → explicit `includeDeleted: true` flag
- PostgreSQL `active_places` VIEW trong DB.md là reference implementation

---

### 27.3 Deduplication Redirect (merged_into Strategy)

**Vấn đề:** Khi crawler phát hiện place A trùng với place B, place A được đánh dấu `status = 'DUPLICATE'`, `merged_into = B.id`. Các bảng con (`place_reviews`, `itinerary_destinations`) vẫn trỏ về A.

**Quyết định thiết kế (intentional):** Giữ nguyên lịch sử — không auto-remap FK về B vì:
- User cần thấy lịch sử chính xác ("tôi đã đến nhà hàng ABC")
- Không thể rollback nếu trigger remap nhầm
- Dedup có thể có false positive — cần human review

**Convention bắt buộc — Application redirect khi query:**

```typescript
// ✅ ĐÚNG — Resolve effective place khi hiển thị cho user
async getEffectivePlace(placeId: UUID): Promise<Place> {
    const place = await this.repo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.mergedInto', 'merged')
        .where('p.id = :id', { id: placeId })
        .getOne();

    // Nếu place này là DUPLICATE → redirect về bản gốc
    if (place?.status === 'DUPLICATE' && place.mergedInto) {
        return place.mergedInto;
    }
    return place;
}

// ✅ ĐÚNG — Khi load itinerary destinations, resolve merged places
// SQL tương đương:
// SELECT COALESCE(p_merged.id, p.id)   AS effective_id,
//        COALESCE(p_merged.name, p.name) AS effective_name, ...
// FROM itinerary_destinations dest
// JOIN places p         ON p.id = dest.place_id
// LEFT JOIN places p_merged ON p_merged.id = p.merged_into
// WHERE dest.itinerary_id = $1

// ❌ SAI — Load place trực tiếp từ FK mà không kiểm tra DUPLICATE
const place = await this.placeRepo.findOne({ where: { id: dest.placeId } });
// → có thể trả về place có status = 'DUPLICATE' (đã bị merge), gây duplicate trên UI
```

**Lưu ý cho Admin UI:**
- Màn hình merge place → sau khi confirm, KHÔNG xóa vật lý A, chỉ set `status = DUPLICATE` và `merged_into = B`
- Admin có thể undo bằng cách reset `status = ACTIVE`, `merged_into = NULL`

---

### 27.4 Concurrent Editing — `itinerary_destinations`

Nhiều EDITOR có thể sửa cùng một itinerary đồng thời. Giải pháp dùng **3 tầng kết hợp**, không dùng pessimistic lock hay `version` column.

#### Tầng 1 — Presence (WebSocket + Redis): Phòng ngừa

Khi user focus vào một field → broadcast cho toàn bộ members trong group biết ai đang sửa gì.

```typescript
// Redis key: presence:itinerary:{itineraryId}
// Hash field: {destinationId}:{fieldName} → { userId, userName, expiresAt }

// Khi focus field
socket.on('START_EDITING', async ({ destinationId, field }) => {
    await redis.hset(
        `presence:itinerary:${itineraryId}`,
        `${destinationId}:${field}`,
        JSON.stringify({ userId, userName, expiresAt: Date.now() + 5000 })
    );
    socket.to(`itinerary:${itineraryId}`).emit('PRESENCE_UPDATE', {
        destinationId, field,
        user: { id: userId, name: userName },
        action: 'START'
    });
});

// Auto-expire sau 5s nếu không renew (user ngừng type / disconnect)
// Client renew mỗi 3s khi đang type
```

**UI hiển thị:**
```
┌─────────────────────────────────────────────┐
│  🏨 Khách sạn ABC                           │
│  Giờ đến:  [09:00]  🔵 An đang sửa...      │  ← field bị mờ
│  Ghi chú:  [Ăn sáng ở đây___]              │  ← bạn đang sửa
└─────────────────────────────────────────────┘
```

**Lý do không dùng pessimistic lock (block toàn bộ row):**
- UX tệ: "Hãy chờ User A hoàn thành" — không chấp nhận được
- Presence chỉ warn, không block — EDITOR vẫn có thể gõ vào field khác

#### Tầng 2 — Field-level PATCH: Auto-resolve conflict khác field

Khi 2 EDITOR sửa **khác field** trên cùng 1 destination → **không có conflict** ở DB level:

```
A: UPDATE SET notes = 'X'       WHERE id = dest_1  → OK
B: UPDATE SET start_time = '9'  WHERE id = dest_1  → OK (khác field)
→ Cả hai thành công, kết quả cuối: notes = 'X', start_time = '9'
```

Xem thêm: **Convention 27.1** — luôn dùng `repo.update()`, không dùng `repo.save()`.

#### Tầng 3 — `updated_at` check: Safety net cho edge case

Khi 2 EDITOR sửa **cùng field** (presence không ngăn kịp do network lag / disconnect):

```typescript
// Server — PATCH /itinerary-destinations/:id
async patchDestination(id: UUID, dto: PatchDestinationDto) {
    const updateData: Partial<ItineraryDestination> = {};
    if (dto.notes      !== undefined) updateData.notes      = dto.notes;
    if (dto.start_time !== undefined) updateData.start_time = dto.start_time;
    if (dto.visit_order!== undefined) updateData.visit_order= dto.visit_order;
    updateData.updated_at = new Date();

    const result = await this.repo
        .createQueryBuilder()
        .update(ItineraryDestination)
        .set(updateData)
        .where('id = :id AND updated_at = :lastSeenAt', {
            id,
            lastSeenAt: dto.last_seen_at  // client gửi kèm updated_at lúc load
        })
        .execute();

    if (result.affected === 0) {
        const current = await this.repo.findOne({ where: { id } });
        throw new ConflictException({
            code: 'STALE_DATA',
            message: 'Field này vừa được cập nhật bởi thành viên khác.',
            current_state: current  // client dùng để compare và merge
        });
    }

    // Broadcast thay đổi cho toàn group
    this.gateway.broadcastToItinerary(itineraryId, {
        type: 'DESTINATION_UPDATED',
        destinationId: id,
        changes: updateData,
        updatedBy: { id: actorId, name: actorName }
    });
}
```

**Client xử lý 409:**
```typescript
if (error.code === 'STALE_DATA') {
    const current = error.current_state;
    const myChange = dto;

    // Tìm xem field tôi đang sửa có bị người khác sửa không
    const conflictingFields = Object.keys(myChange)
        .filter(f => f !== 'last_seen_at' && current[f] !== original[f]);

    if (conflictingFields.length === 0) {
        // Người khác sửa field khác → auto-merge: retry với last_seen_at mới
        dto.last_seen_at = current.updated_at;
        return this.patchDestination(id, dto);  // retry
    } else {
        // Cùng field → prompt user
        showConflictDialog({
            field: conflictingFields[0],
            myValue: myChange[conflictingFields[0]],
            theirValue: current[conflictingFields[0]]
        });
    }
}
```

#### Xử lý Reorder đồng thời

```
Fractional ordering: không dùng UNIQUE constraint (đã bỏ khỏi DB.md)

A và B cùng kéo place vào giữa 1.0 và 2.0:
  → Cả hai tính visit_order = 1.5
  → Cả hai UPDATE thành công (không UNIQUE violation)
  → Tie: ORDER BY visit_order, created_at làm tiebreaker
  → Chấp nhận được — thứ tự consistent, không crash

Khi precision cạn (gap < 0.0001):
  → Client detect → gửi bulk re-normalize request cho toàn bộ ngày đó
  → Server: UPDATE SET visit_order = 1.0 / 2.0 / 3.0... theo thứ tự hiện tại
  → Hiếm xảy ra trong thực tế
```

#### Tóm tắt 4 loại operation

| Operation | Conflict? | Giải pháp |
|-----------|:---------:|-----------|
| ADD place | ❌ | INSERT row mới → luôn thành công |
| REMOVE place | ❌ | 0 rows affected → idempotent |
| EDIT khác field | ❌ | Field-level PATCH → auto-resolve |
| EDIT cùng field | ⚠️ | `updated_at` check → 409 → client merge/prompt |
| REORDER | ⚠️ tie | Không UNIQUE → tie-break by `created_at` |

---

### 27.5 Concurrent Editing — `itineraries` (Master Record)

Đơn giản hơn `itinerary_destinations` vì **chỉ OWNER mới sửa metadata** và hầu hết group có 1 OWNER duy nhất.

#### Phân loại field

```
User-editable (OWNER only):
  title, description, start_date, end_date, total_budget, budget_level, is_public
  status  ← STATE MACHINE, xử lý riêng

System-managed (service layer, không cho user sửa trực tiếp):
  total_places    ← tăng/giảm khi add/remove itinerary_destinations
  estimated_cost  ← AI computed
  ai_prompt       ← set once bởi AI agent, immutable sau đó
  is_ai_generated ← set once
```

#### `updated_at` check cho metadata

```typescript
// PATCH /itineraries/:id — chỉ OWNER
async patchMetadata(id: UUID, dto: PatchItineraryDto, actorId: UUID) {
    const updateData: Partial<Itinerary> = {};
    if (dto.title        !== undefined) updateData.title        = dto.title;
    if (dto.description  !== undefined) updateData.description  = dto.description;
    if (dto.start_date   !== undefined) updateData.start_date   = dto.start_date;
    if (dto.end_date     !== undefined) updateData.end_date     = dto.end_date;
    if (dto.total_budget !== undefined) updateData.total_budget = dto.total_budget;
    if (dto.is_public    !== undefined) updateData.is_public    = dto.is_public;
    // status KHÔNG update ở đây → endpoint riêng có state machine guard
    updateData.updated_at = new Date();

    const result = await this.repo
        .createQueryBuilder()
        .update(Itinerary)
        .set(updateData)
        .where('id = :id AND updated_at = :lastSeenAt', { id, lastSeenAt: dto.last_seen_at })
        .execute();

    if (result.affected === 0)
        throw new ConflictException({ code: 'STALE_DATA', current: await this.findOne(id) });
}
```

#### State machine guard cho `status`

```typescript
const VALID_TRANSITIONS: Record<ItineraryStatus, ItineraryStatus[]> = {
    DRAFT:     ['PUBLISHED'],
    PUBLISHED: ['DRAFT', 'ARCHIVED'],
    ARCHIVED:  ['PUBLISHED'],
};

// PATCH /itineraries/:id/status — endpoint riêng, chỉ OWNER
async updateStatus(id: UUID, newStatus: ItineraryStatus, actorId: UUID) {
    const itinerary = await this.repo.findOne({ where: { id } });

    if (!VALID_TRANSITIONS[itinerary.status].includes(newStatus))
        throw new BadRequestException(
            `Không thể chuyển từ ${itinerary.status} → ${newStatus}`
        );

    await this.repo.update(id, { status: newStatus, updated_at: new Date() });

    this.gateway.broadcastToItinerary(id, {
        type: 'ITINERARY_STATUS_CHANGED',
        newStatus,
        updatedBy: actorId
    });
}
```

#### WebSocket events cho `itineraries`

```typescript
// Broadcast khi OWNER thay đổi metadata — EDITOR/VIEWER cần biết để cập nhật UI
{ type: 'ITINERARY_METADATA_UPDATED', changes: { title, start_date, ... }, updatedBy }
{ type: 'ITINERARY_STATUS_CHANGED',   newStatus: 'PUBLISHED', updatedBy }
{ type: 'ITINERARY_PUBLISHED' }   // ← VIEWER nhận → có thể share link
{ type: 'ITINERARY_ARCHIVED'  }   // ← EDITOR nhận → lock editing
```
