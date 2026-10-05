-- =============================================================================
-- TRIPGENIE — DATABASE SCHEMA (v4)
-- Cập nhật theo quyết định design review:
--   [NEW]    Thêm group_role_enum ('OWNER', 'EDITOR', 'VIEWER')
--   [MOD]    group_members.role: VARCHAR(20) → group_role_enum, default 'VIEWER'
--   [REMOVE] version INT khỏi itineraries và itinerary_destinations
--   [REMOVE] fn_increment_version() trigger function và 2 triggers liên quan
-- Lý do bỏ version: collaboration model dùng proposals/votes (VIEWER) + fractional
-- ordering (EDITOR) → không có multi-writer conflict trên cùng 1 row
-- =============================================================================

-- =============================================================================
-- 1. KÍCH HOẠT CÁC EXTENSION CẦN THIẾT
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";    -- Spatial Query
CREATE EXTENSION IF NOT EXISTS "vector";     -- Vector Embedding (Agentic RAG)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- Fuzzy text matching (deduplication)
CREATE EXTENSION IF NOT EXISTS "citext";     -- Case-insensitive text (email unique)
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- Bỏ dấu tiếng Việt cho name_normalized

-- =============================================================================
-- 2. TẠO CÁC KIỂU DỮ LIỆU ENUM
-- =============================================================================
CREATE TYPE user_role_enum        AS ENUM ('ADMIN', 'USER');
CREATE TYPE auth_provider_enum    AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK', 'GITHUB');
CREATE TYPE budget_level_enum     AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'LUXURY');
CREATE TYPE place_status_enum     AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'DUPLICATE');
CREATE TYPE chat_sender_enum      AS ENUM ('USER', 'AGENT', 'TOOL');
CREATE TYPE crawl_job_type_enum   AS ENUM ('REGION_CRAWL', 'PLACE_SYNC', 'EMBEDDING_GEN');
CREATE TYPE crawl_job_status_enum AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE sync_status_enum      AS ENUM ('OK', 'STALE', 'ERROR', 'PENDING');
CREATE TYPE coverage_status_enum  AS ENUM ('COMPLETE', 'PARTIAL', 'NOT_COVERED', 'STALE');
CREATE TYPE itinerary_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
-- [MED] Enum hoá travel_areas.type thay vì VARCHAR tự do (tránh typo 'city' vs 'City')
CREATE TYPE area_type_enum        AS ENUM ('COUNTRY', 'PROVINCE', 'CITY', 'DISTRICT', 'ZONE');
-- Group collaboration roles:
--   OWNER  → toàn quyền (edit metadata, add/remove/reorder places, invite, publish)
--   EDITOR → tin cậy, edit trực tiếp places (add/remove/reorder), không sửa metadata/publish
--   VIEWER → chỉ xem + đề xuất qua proposals/votes, không write trực tiếp
CREATE TYPE group_role_enum       AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
-- [HIGH] Enum cho audit log action
CREATE TYPE audit_action_enum     AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'BAN', 'UNBAN',
    'TRIGGER_CRAWL', 'CANCEL_CRAWL'
);
-- [HIGH] Enum cho content report
CREATE TYPE report_type_enum      AS ENUM ('SPAM', 'INAPPROPRIATE', 'FALSE_INFO', 'COPYRIGHT', 'OTHER');
CREATE TYPE report_status_enum    AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- =============================================================================
-- 3. PHÂN HỆ QUẢN LÝ NGƯỜI DÙNG & XÁC THỰC (USER & AUTH)
-- =============================================================================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- [MED] citext tự động so sánh case-insensitive — tránh trùng tài khoản do hoa/thường
    email         CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name     VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    phone_number  VARCHAR(20),
    role          user_role_enum DEFAULT 'USER',
    is_active     BOOLEAN DEFAULT true,
    is_verified   BOOLEAN DEFAULT false,
    verified_at   TIMESTAMP WITH TIME ZONE,
    -- [HIGH] Soft-delete: không xóa vật lý, trace được ai đã từng có tài khoản
    deleted_at    TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Partial index: chỉ enforce uniqueness email trên tài khoản chưa bị soft-delete
CREATE UNIQUE INDEX uq_users_email_active ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE user_identities (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         auth_provider_enum NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    identity_data    JSONB,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_provider_user UNIQUE(provider, provider_user_id)
);

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
-- 4. KHU VỰC DU LỊCH (TRAVEL AREAS)
-- =============================================================================

CREATE TABLE travel_areas (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    name_vi      VARCHAR(100),
    slug         VARCHAR(100) UNIQUE NOT NULL,
    -- [MED] Enum thay vì VARCHAR tự do — nhất quán, tránh typo
    type         area_type_enum NOT NULL,
    parent_id    INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    bbox_min_lat DOUBLE PRECISION,
    bbox_max_lat DOUBLE PRECISION,
    bbox_min_lng DOUBLE PRECISION,
    bbox_max_lng DOUBLE PRECISION,
    -- [MED] CHECK: bbox hợp lệ nếu có
    CONSTRAINT chk_bbox_lat CHECK (bbox_min_lat IS NULL OR (bbox_min_lat >= -90  AND bbox_max_lat <= 90  AND bbox_min_lat < bbox_max_lat)),
    CONSTRAINT chk_bbox_lng CHECK (bbox_min_lng IS NULL OR (bbox_min_lng >= -180 AND bbox_max_lng <= 180 AND bbox_min_lng < bbox_max_lng)),
    boundary     GEOGRAPHY(POLYGON, 4326),
    is_active    BOOLEAN DEFAULT true
);

-- =============================================================================
-- 5. PHÂN HỆ ĐỊA ĐIỂM & VECTOR SEARCH (PLACES & RAG DATA)
-- =============================================================================

CREATE TABLE categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    name_vi    VARCHAR(100),
    slug       VARCHAR(100) UNIQUE NOT NULL,
    icon_url   TEXT,
    parent_id  INT REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0
);

CREATE TABLE places (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    -- [MED] Auto-populated bởi trigger (unaccent + lower) — dùng cho pg_trgm fuzzy search
    name_normalized VARCHAR(255),
    description     TEXT,
    category_id     INT REFERENCES categories(id) ON DELETE SET NULL,
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,

    -- Địa chỉ text — derive từ area_id nhưng giữ lại để display
    -- [HIGH] Không có DEFAULT 'Hồ Chí Minh' — crawler PHẢI set đúng giá trị
    address         TEXT NOT NULL,
    district        VARCHAR(100),
    city            VARCHAR(100),
    province        VARCHAR(100),
    country         VARCHAR(50) DEFAULT 'Vietnam',

    -- Tọa độ
    -- [INTENTIONAL] Constraint giới hạn lãnh thổ Việt Nam — quyết định product scope có chủ đích.
    -- Scope hiện tại: Vietnam-only. Nếu mở rộng SEA: ALTER TABLE DROP CONSTRAINT (1 dòng migration).
    -- lat 8.0–23.5 (Cà Mau → Lũng Cú), lng 102.0–110.0 (biên giới Tây → Hoàng Sa)
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    CONSTRAINT chk_latitude  CHECK (latitude  BETWEEN  8.0 AND 23.5),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN 102.0 AND 110.0),
    location        GEOGRAPHY(POINT, 4326),  -- Auto-populated bởi trigger

    -- Giá
    price_range     JSONB,
    -- [MED] price_level được derive và đồng bộ từ price_range qua trigger
    -- Không tự ý update price_level mà không update price_range
    price_level     budget_level_enum,
    opening_hours   JSONB,

    -- Liên hệ
    phone           VARCHAR(30),
    website         TEXT,

    -- Đánh giá (computed bởi trigger)
    rating_avg      FLOAT DEFAULT 0.0 CHECK (rating_avg BETWEEN 0.0 AND 5.0),
    review_count    INT DEFAULT 0 CHECK (review_count >= 0),
    image_count     INT DEFAULT 0 CHECK (image_count >= 0),

    -- Tags & attributes
    tags            TEXT[] DEFAULT '{}',
    attributes      JSONB DEFAULT '{}',

    -- Trạng thái
    status          place_status_enum DEFAULT 'ACTIVE',
    -- Khi dedup merge: place này là bản trùng, point về place gốc
    merged_into     UUID REFERENCES places(id) ON DELETE SET NULL,

    -- [HIGH] Soft-delete
    deleted_at      TIMESTAMP WITH TIME ZONE,

    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE place_images (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id      UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INT DEFAULT 0,
    is_primary    BOOLEAN DEFAULT false,
    caption       TEXT,
    source        VARCHAR(50),       -- 'user_upload', 'google', 'osm'
    -- [MED] Truy vết ai upload ảnh — cần cho kiểm duyệt bản quyền
    uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    width         INT,
    height        INT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vector embedding 1:1 với places — tách bảng riêng vì vector ~6KB/row
CREATE TABLE place_embeddings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id      UUID UNIQUE NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    content_text  TEXT NOT NULL,
    embedding     VECTOR(1536),
    model_name    VARCHAR(100),
    model_version VARCHAR(50),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data provenance: dedup theo external_id, sync định kỳ từ provider
CREATE TABLE place_sources (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id            UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    provider            VARCHAR(50) NOT NULL,
    external_id         VARCHAR(255) NOT NULL,
    external_url        TEXT,
    raw_data            JSONB,
    last_synced_at      TIMESTAMP WITH TIME ZONE,
    sync_status         sync_status_enum DEFAULT 'PENDING',
    sync_error          TEXT,
    sync_attempt_count  INT DEFAULT 0,
    -- Rating từ provider — KHÔNG overwrite places.rating_avg (internal review)
    source_rating       FLOAT CHECK (source_rating IS NULL OR source_rating BETWEEN 0.0 AND 5.0),
    source_review_count INT CHECK (source_review_count IS NULL OR source_review_count >= 0),
    CONSTRAINT uq_provider_external UNIQUE(provider, external_id)
);

-- =============================================================================
-- 6. PHÂN HỆ ĐÁNH GIÁ & BỘ SƯU TẬP (REVIEWS & COLLECTIONS)
-- =============================================================================

-- PARTITION STRATEGY NOTE (Low priority — chuẩn bị sẵn):
-- Khi place_reviews đạt >1M rows, cân nhắc PARTITION BY RANGE(created_at)
-- Ví dụ: partition theo năm (2024, 2025, 2026...)
CREATE TABLE place_reviews (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id      UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    -- [MED] CHECK: rating hợp lệ 1-5
    rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title         VARCHAR(255),
    comment       TEXT,
    images        TEXT[],
    visited_at    DATE,
    helpful_count INT DEFAULT 0 CHECK (helpful_count >= 0),
    -- [HIGH] Soft-delete: không xóa review, để lại dấu vết
    deleted_at    TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_place_review UNIQUE(user_id, place_id)
);

CREATE TABLE collections (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    is_public   BOOLEAN DEFAULT false,
    cover_image TEXT,
    deleted_at  TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_places (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    place_id      UUID REFERENCES places(id) ON DELETE CASCADE,
    notes         TEXT,
    added_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, place_id)
);

-- =============================================================================
-- 7. PHÂN HỆ LẬP KẾ HOẠCH & TƯƠNG TÁC NHÓM (ITINERARIES & GROUPS)
-- =============================================================================

CREATE TABLE itineraries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,

    -- Trip metadata
    destination     VARCHAR(255),
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,
    -- [MED] CHECK: end_date không trước start_date
    CONSTRAINT chk_itinerary_dates CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
    ),

    -- Budget
    total_budget    DECIMAL(12, 2) CHECK (total_budget IS NULL OR total_budget >= 0),
    budget_level    budget_level_enum,
    estimated_cost  DECIMAL(12, 2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),

    -- AI metadata
    is_ai_generated BOOLEAN DEFAULT false,
    ai_prompt       TEXT,
    ai_preferences  JSONB,

    -- Sharing & status
    status          itinerary_status_enum DEFAULT 'DRAFT',
    is_public       BOOLEAN DEFAULT false,
    cloned_from_id  UUID REFERENCES itineraries(id) ON DELETE SET NULL,

    -- Aggregate
    total_places    INT DEFAULT 0 CHECK (total_places >= 0),

    -- [HIGH] Soft-delete
    deleted_at      TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE itinerary_destinations (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id               UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    place_id                   UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    day_number                 INT DEFAULT 1 CHECK (day_number >= 1),

    -- Fractional ordering: reorder chỉ cần UPDATE 1 row thay vì renumber toàn bộ
    -- Ví dụ: chèn giữa 1.0 và 2.0 → 1.5; chèn giữa 1.0 và 1.5 → 1.25
    -- Khi precision cạn (gap < 0.0001), client bulk re-normalize toàn bộ ngày đó
    -- KHÔNG dùng UNIQUE constraint vì concurrent reorder có thể tạo tie (cùng giá trị)
    -- Tie-break ở application: ORDER BY day_number, visit_order, created_at
    visit_order                DECIMAL(12, 6) NOT NULL,

    start_time                 TIME,
    end_time                   TIME,
    estimated_duration_minutes INT DEFAULT 60 CHECK (estimated_duration_minutes > 0),
    estimated_cost             DECIMAL(10, 2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    travel_distance_meters     INT CHECK (travel_distance_meters IS NULL OR travel_distance_meters >= 0),
    travel_duration_seconds    INT CHECK (travel_duration_seconds IS NULL OR travel_duration_seconds >= 0),
    notes                      TEXT,

    -- updated_at dùng cho optimistic concurrency check (PATCH với last_seen_at)
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_groups (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    invite_code  VARCHAR(20) UNIQUE NOT NULL,
    max_members  INT DEFAULT 20 CHECK (max_members > 0),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    -- OWNER: toàn quyền (edit metadata, places, invite, publish)
    -- EDITOR: edit trực tiếp itinerary_destinations (add/remove/reorder), không sửa metadata
    -- VIEWER: read-only + đề xuất qua group_place_proposals/votes
    -- NOTE: OWNER luôn là creator ban đầu; chỉ OWNER mới được nâng/hạ role người khác
    role          group_role_enum NOT NULL DEFAULT 'VIEWER',
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
-- 8. PHÂN HỆ AI AGENT & CHAT MEMORY (AGENTIC RAG CORE)
-- =============================================================================

-- PARTITION STRATEGY NOTE (Low priority):
-- Khi ai_chat_messages đạt >5M rows, partition BY RANGE(created_at) theo tháng
CREATE TABLE ai_chat_sessions (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                      VARCHAR(255) DEFAULT 'Trò chuyện mới',
    summary                    TEXT,
    -- [MED] Intentionally NO FK constraint trên last_summarized_message_id
    -- Lý do: tránh cascade issue khi messages bị cleanup/archive
    -- Trade-off: có thể trỏ tới message không còn tồn tại — chấp nhận được,
    -- app phải handle gracefully khi fetch message này
    last_summarized_message_id UUID,
    last_summarized_at         TIMESTAMP WITH TIME ZONE,
    linked_itinerary_id        UUID REFERENCES itineraries(id) ON DELETE SET NULL,
    context_city               VARCHAR(100),
    message_count              INT DEFAULT 0 CHECK (message_count >= 0),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_chat_messages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id   UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    sender       chat_sender_enum NOT NULL,
    content      TEXT,
    tool_calls   JSONB,
    tool_results JSONB,
    token_count  INT CHECK (token_count IS NULL OR token_count >= 0),
    latency_ms   INT CHECK (latency_ms IS NULL OR latency_ms >= 0),
    model_name   VARCHAR(100),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 9. PHÂN HỆ CỘNG ĐỒNG (COMMUNITY POSTS & INTERACTIONS)
-- =============================================================================

CREATE TABLE community_posts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    itinerary_id  UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    caption       TEXT,
    like_count    INT NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    comment_count INT NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
    clone_count   INT NOT NULL DEFAULT 0 CHECK (clone_count >= 0),
    -- [HIGH] Soft-delete: giữ lại record cho audit trail
    deleted_at    TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    -- [HIGH] Soft-delete: không xóa vật lý — giữ thread, hiển thị "[Đã xóa]"
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- [HIGH] Report/Moderation cho nội dung cộng đồng
-- Không có cơ chế này thì không thể vận hành khi có nội dung vi phạm
CREATE TABLE content_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Polymorphic target: report có thể nhắm vào post, comment, review, hoặc place
    -- CHECK constraint thay vì FK vì SQL không hỗ trợ polymorphic FK
    target_type     VARCHAR(50) NOT NULL,
    CONSTRAINT chk_report_target_type CHECK (
        target_type IN ('post', 'comment', 'review', 'place')
    ),
    target_id       UUID NOT NULL,

    report_type     report_type_enum NOT NULL,
    description     TEXT,
    status          report_status_enum DEFAULT 'PENDING',

    -- Admin xử lý
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMP WITH TIME ZONE,
    resolution_note TEXT,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10. CRAWLER INFRASTRUCTURE
-- =============================================================================

CREATE TABLE data_coverage (
    area_id         INT PRIMARY KEY REFERENCES travel_areas(id) ON DELETE CASCADE,
    place_count     INT DEFAULT 0 CHECK (place_count >= 0),
    status          coverage_status_enum DEFAULT 'NOT_COVERED',
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    stale_threshold INTERVAL DEFAULT '7 days',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PARTITION STRATEGY NOTE (Low priority):
-- Khi crawl_jobs đạt >500K rows, archive jobs cũ sang crawl_jobs_archive
-- hoặc PARTITION BY RANGE(created_at) theo tháng
CREATE TABLE crawl_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type        crawl_job_type_enum NOT NULL,
    status          crawl_job_status_enum DEFAULT 'PENDING',
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    place_id        UUID REFERENCES places(id) ON DELETE SET NULL,
    provider        VARCHAR(50),
    params          JSONB DEFAULT '{}',
    priority        INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    total_items     INT CHECK (total_items IS NULL OR total_items >= 0),
    processed_items INT DEFAULT 0 CHECK (processed_items >= 0),
    inserted_count  INT DEFAULT 0 CHECK (inserted_count >= 0),
    updated_count   INT DEFAULT 0 CHECK (updated_count >= 0),
    duplicate_count INT DEFAULT 0 CHECK (duplicate_count >= 0),
    error_count     INT DEFAULT 0 CHECK (error_count >= 0),
    checkpoint      JSONB DEFAULT '{}',
    scheduled_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    last_error      TEXT,
    retry_count     INT DEFAULT 0 CHECK (retry_count >= 0),
    max_retries     INT DEFAULT 3 CHECK (max_retries >= 0),
    bullmq_job_id   VARCHAR(255),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 11. PHÂN HỆ RAG — KNOWLEDGE BASE
-- =============================================================================

CREATE TABLE knowledge_documents (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(255) NOT NULL,
    source_type   VARCHAR(50) NOT NULL,
    source_url    TEXT,
    content       TEXT NOT NULL,
    language      VARCHAR(10) DEFAULT 'vi',
    area_id       INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    category_tags TEXT[] DEFAULT '{}',
    is_processed  BOOLEAN DEFAULT false,
    chunk_count   INT DEFAULT 0 CHECK (chunk_count >= 0),
    processed_at  TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL CHECK (chunk_index >= 0),
    content     TEXT NOT NULL,
    embedding   VECTOR(1536),
    model_name  VARCHAR(100),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 12. AUDIT TRAIL — ADMIN ACTIONS
-- [HIGH] Trace "ai đã làm gì, lúc nào, trên đối tượng nào" — bắt buộc khi có ADMIN role
-- =============================================================================

CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_role    user_role_enum NOT NULL,
    action        audit_action_enum NOT NULL,

    -- Polymorphic target
    -- CHECK constraint thay vì FK vì SQL không hỗ trợ polymorphic FK
    target_type   VARCHAR(50) NOT NULL,
    CONSTRAINT chk_audit_target_type CHECK (
        target_type IN ('place', 'review', 'user', 'crawl_job',
                        'itinerary', 'community_post', 'post_comment')
    ),
    target_id     UUID,                   -- NULL cho actions không có entity cụ thể
    target_label  TEXT,                   -- Human-readable: "Nhà hàng ABC" (snapshot tên lúc đó)

    -- Payload: before/after state để có thể rollback hoặc audit
    before_data   JSONB,
    after_data    JSONB,

    -- Metadata
    ip_address    INET,
    user_agent    TEXT,
    notes         TEXT,

    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 13. TỐI ƯU HÓA CHỈ MỤC (INDEXES)
-- =============================================================================

-- Spatial & Vector Indexes
CREATE INDEX idx_places_location         ON places USING GIST (location);
CREATE INDEX idx_travel_areas_boundary   ON travel_areas USING GIST (boundary);
CREATE INDEX idx_place_embeddings_hnsw   ON place_embeddings
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_knowledge_chunks_hnsw   ON knowledge_chunks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Fuzzy text search
CREATE INDEX idx_places_name_trgm        ON places USING GIN (name_normalized gin_trgm_ops);

-- Places
CREATE INDEX idx_places_category         ON places(category_id);
CREATE INDEX idx_places_area             ON places(area_id);
CREATE INDEX idx_places_district         ON places(district);
CREATE INDEX idx_places_status_city      ON places(status, city) WHERE status = 'ACTIVE' AND deleted_at IS NULL;
CREATE INDEX idx_places_rating           ON places(rating_avg DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_places_price_level      ON places(price_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_place_images_place      ON place_images(place_id);

-- Soft-delete support (queries thường chỉ cần active records)
CREATE INDEX idx_places_deleted          ON places(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_deleted           ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Place Sources
CREATE INDEX idx_place_sources_place     ON place_sources(place_id);
CREATE INDEX idx_place_sources_provider  ON place_sources(provider, external_id);

-- Itinerary ordering
CREATE INDEX idx_itinerary_dest_order    ON itinerary_destinations(itinerary_id, day_number, visit_order);

-- Community & Feed (Cursor Pagination)
CREATE INDEX idx_community_posts_created      ON community_posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_posts_user_created ON community_posts(user_id, created_at DESC);
CREATE INDEX idx_post_comments_post_created   ON post_comments(post_id, created_at DESC) WHERE deleted_at IS NULL;

-- Content Reports
CREATE INDEX idx_content_reports_status  ON content_reports(status) WHERE status = 'PENDING';
CREATE INDEX idx_content_reports_target  ON content_reports(target_type, target_id);

-- Audit Logs
CREATE INDEX idx_audit_logs_actor        ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_target       ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created      ON audit_logs(created_at DESC);

-- Crawler
CREATE INDEX idx_crawl_jobs_status       ON crawl_jobs(status);
CREATE INDEX idx_crawl_jobs_area         ON crawl_jobs(area_id);

-- Knowledge Base
CREATE INDEX idx_knowledge_chunks_doc    ON knowledge_chunks(document_id, chunk_index);

-- Foreign Key Indexes
CREATE INDEX idx_reviews_user              ON place_reviews(user_id);
CREATE INDEX idx_reviews_place             ON place_reviews(place_id);
CREATE INDEX idx_collections_user          ON collections(user_id);
CREATE INDEX idx_itineraries_creator       ON itineraries(creator_id);
CREATE INDEX idx_group_members_user        ON group_members(user_id);
CREATE INDEX idx_group_proposals_group     ON group_place_proposals(trip_group_id);
CREATE INDEX idx_group_proposals_place     ON group_place_proposals(place_id);
CREATE INDEX idx_ai_chat_sessions_user     ON ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_messages_session  ON ai_chat_messages(session_id);

-- =============================================================================
-- 14. TRIGGERS
-- =============================================================================

-- Trigger 1: Auto-populate PostGIS location từ lat/lng + normalize tên
CREATE OR REPLACE FUNCTION fn_update_places_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    -- Auto-normalize tên: bỏ dấu tiếng Việt, lowercase, trim
    -- Dùng cho pg_trgm fuzzy search & deduplication
    NEW.name_normalized = lower(trim(unaccent(NEW.name)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_places_location_name
BEFORE INSERT OR UPDATE OF latitude, longitude, name ON places
FOR EACH ROW EXECUTE FUNCTION fn_update_places_location();

-- Trigger 2: Auto-update rating_avg và review_count khi có review mới / xóa
-- Chỉ tính review chưa bị soft-delete
CREATE OR REPLACE FUNCTION fn_update_place_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_place_id UUID;
BEGIN
    target_place_id := COALESCE(NEW.place_id, OLD.place_id);
    UPDATE places
    SET
        rating_avg   = (
            SELECT COALESCE(AVG(rating::FLOAT), 0.0)
            FROM place_reviews
            WHERE place_id = target_place_id AND deleted_at IS NULL
        ),
        review_count = (
            SELECT COUNT(*)
            FROM place_reviews
            WHERE place_id = target_place_id AND deleted_at IS NULL
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_place_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_place_rating
    AFTER INSERT OR UPDATE OR DELETE ON place_reviews
    FOR EACH ROW EXECUTE FUNCTION fn_update_place_rating();

-- Trigger 3: [MED] Đồng bộ price_level từ price_range
-- Ngưỡng áp dụng CHỈ KHI currency = 'VND'. Currency khác → price_level = NULL.
-- Lý do: crawler quốc tế có thể trả về USD, áp ngưỡng VND lên USD sẽ gây silent bug.
-- Mapping VND:
--   < 100,000       → LOW
--   100,000–300,000 → MEDIUM
--   300,000–800,000 → HIGH
--   > 800,000       → LUXURY
CREATE OR REPLACE FUNCTION fn_sync_price_level()
RETURNS TRIGGER AS $$
DECLARE
    mid_price NUMERIC;
    currency  TEXT;
BEGIN
    IF NEW.price_range IS NOT NULL
       AND NEW.price_range ? 'min'
       AND NEW.price_range ? 'max'
    THEN
        currency := NEW.price_range->>'currency';
        IF currency = 'VND' THEN
            mid_price := (
                (NEW.price_range->>'min')::NUMERIC +
                (NEW.price_range->>'max')::NUMERIC
            ) / 2.0;
            NEW.price_level := CASE
                WHEN mid_price < 100000 THEN 'LOW'::budget_level_enum
                WHEN mid_price < 300000 THEN 'MEDIUM'::budget_level_enum
                WHEN mid_price < 800000 THEN 'HIGH'::budget_level_enum
                ELSE                         'LUXURY'::budget_level_enum
            END;
        ELSE
            -- Currency khác VND (USD, THB...) hoặc thiếu currency field
            -- → set NULL, để batch job riêng xử lý conversion
            NEW.price_level := NULL;
        END IF;
    ELSE
        -- price_range NULL hoặc thiếu min/max → không derive
        NEW.price_level := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_price_level
BEFORE INSERT OR UPDATE OF price_range ON places
FOR EACH ROW EXECUTE FUNCTION fn_sync_price_level();

-- Trigger 5: Chặn xóa/hạ quyền OWNER cuối cùng của một trip_group
-- Hệ quả nếu không có trigger: group không có ai quản trị — orphan group,
-- không thể invite, không thể publish — lỗi vận hành im lặng.
CREATE OR REPLACE FUNCTION fn_prevent_ownerless_group()
RETURNS TRIGGER AS $$
BEGIN
    -- Kích hoạt khi: xóa OWNER, hoặc hạ OWNER xuống EDITOR/VIEWER
    IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER') OR
       (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND NEW.role != 'OWNER')
    THEN
        IF NOT EXISTS (
            SELECT 1 FROM group_members
            WHERE trip_group_id = OLD.trip_group_id
              AND user_id != OLD.user_id
              AND role = 'OWNER'
        ) THEN
            RAISE EXCEPTION
                'trip_group % phải có ít nhất 1 OWNER. Hãy chuyển quyền OWNER trước khi rời nhóm.',
                OLD.trip_group_id;
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_ownerless_group
BEFORE DELETE OR UPDATE OF role ON group_members
FOR EACH ROW EXECUTE FUNCTION fn_prevent_ownerless_group();

-- =============================================================================
-- 15. VIEWS — QUERY HELPERS
-- =============================================================================

-- active_places: View loại trừ soft-deleted places
-- [BẮTBUỘC] Mọi query người dùng liên quan places PHẢI dùng view này thay vì table trực tiếp.
-- Lý do: khi places.deleted_at IS NOT NULL, các bảng con (place_reviews,
-- itinerary_destinations, collection_places) không tự phản ánh vì đây là soft-delete
-- (FK CASCADE vật lý không kích hoạt). Dùng view này làm base giúp tránh mỗi dev
-- phải tự thêm WHERE deleted_at IS NULL — dễ sót, gây rò rỉ dữ liệu đã xóa.
CREATE OR REPLACE VIEW active_places AS
    SELECT * FROM places
    WHERE deleted_at IS NULL
      AND status != 'DUPLICATE';   -- Loại cả bản trùng đã merge

-- =============================================================================
-- 16. DESIGN DECISIONS — GHI CHÚ KIẾN TRÚC
-- =============================================================================

-- [1] FIELD-LEVEL UPDATE — MANDATORY CONVENTION
-- itinerary_destinations cho phép EDITOR và OWNER sửa trực tiếp.
-- Nếu application gửi full-object UPDATE (UPDATE ... SET col1=$1, col2=$2, col3=$3...),
-- 2 EDITOR sửa field khác nhau của cùng 1 row cùng lúc sẽ gây SILENT DATA LOSS
-- (người sau ghi đè toàn bộ, kể cả field người trước vừa sửa).
-- CONVENTION BẮT BUỘC: Chỉ dùng field-level PATCH, KHÔNG dùng full-object PUT.
--   ✅ UPDATE itinerary_destinations SET notes = $1 WHERE id = $2
--   ✅ UPDATE itinerary_destinations SET start_time = $1 WHERE id = $2
--   ❌ UPDATE itinerary_destinations SET notes=$1, start_time=$2, ... WHERE id=$n
-- Xem thêm: ARCHITECTURE.md > Convention > Field-Level Update

-- [2] MERGED_INTO — INTENTIONAL REDIRECT STRATEGY (Option A: Application-level)
-- Khi place A bị merge vào B (A.status = 'DUPLICATE', A.merged_into = B.id):
--   - place_reviews, itinerary_destinations, collection_places vẫn trỏ về A
--   - Đây là INTENTIONAL: giữ nguyên lịch sử ("tôi đã đến nhà hàng ABC")
--   - Application layer chịu trách nhiệm redirect khi query:
--       SELECT COALESCE(p_merged.id, p.id) AS effective_place_id
--       FROM places p
--       LEFT JOIN places p_merged ON p.merged_into = p_merged.id
--       WHERE p.id = $1
--   - KHÔNG trigger auto-remap FK vì mất lịch sử, không rollback được
-- Xem thêm: ARCHITECTURE.md > Convention > Deduplication Redirect

-- [3] SOFT-DELETE PROPAGATION — REPOSITORY LAYER RESPONSIBILITY
-- Khi places.deleted_at IS NOT NULL (admin soft-delete):
--   - FK references trong bảng con (place_reviews, itinerary_destinations...) KHÔNG tự xóa
--   - Mọi query cần join places PHẢI dùng active_places view hoặc thêm WHERE places.deleted_at IS NULL
--   - Trách nhiệm này thuộc về service/repository layer, KHÔNG phải DB schema
-- Convention: Tất cả PlaceRepository method mặc định query từ active_places,
--   chỉ dùng places trực tiếp cho ADMIN endpoints cần xem cả deleted records.
-- Xem thêm: ARCHITECTURE.md > Convention > Soft-Delete Propagation

-- NOTE: version column và optimistic locking KHÔNG áp dụng cho itineraries/itinerary_destinations
-- Lý do:
--   1. itineraries — chỉ OWNER mới sửa metadata → single-writer, không conflict
--   2. itinerary_destinations — mỗi place là 1 row riêng; EDITOR add/remove không đụng nhau;
--      reorder dùng fractional DECIMAL → chỉ UPDATE 1 row, không cascade renumber
--   3. Conflict thực tế (xóa đúng 1 place cùng lúc) → last-write-wins chấp nhận được
--   4. updated_at đủ làm lightweight conflict hint nếu cần ở tương lai
