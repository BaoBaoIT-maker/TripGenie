-- =============================================================================
-- TRIPGENIE â€” DATABASE SCHEMA (v4)
-- Cáº­p nháº­t theo quyáº¿t Ä‘á»‹nh design review:
--   [NEW]    ThÃªm group_role_enum ('OWNER', 'EDITOR', 'VIEWER')
--   [MOD]    group_members.role: VARCHAR(20) â†’ group_role_enum, default 'VIEWER'
--   [REMOVE] version INT khá»i itineraries vÃ  itinerary_destinations
--   [REMOVE] fn_increment_version() trigger function vÃ  2 triggers liÃªn quan
-- LÃ½ do bá» version: collaboration model dÃ¹ng proposals/votes (VIEWER) + fractional
-- ordering (EDITOR) â†’ khÃ´ng cÃ³ multi-writer conflict trÃªn cÃ¹ng 1 row
-- =============================================================================

-- =============================================================================
-- 1. KÃCH HOáº T CÃC EXTENSION Cáº¦N THIáº¾T
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";    -- Spatial Query
CREATE EXTENSION IF NOT EXISTS "vector";     -- Vector Embedding (Agentic RAG)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- Fuzzy text matching (deduplication)
CREATE EXTENSION IF NOT EXISTS "citext";     -- Case-insensitive text (email unique)
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- Bá» dáº¥u tiáº¿ng Viá»‡t cho name_normalized

-- =============================================================================
-- 2. Táº O CÃC KIá»‚U Dá»® LIá»†U ENUM
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
-- [MED] Enum hoÃ¡ travel_areas.type thay vÃ¬ VARCHAR tá»± do (trÃ¡nh typo 'city' vs 'City')
CREATE TYPE area_type_enum        AS ENUM ('COUNTRY', 'PROVINCE', 'CITY', 'DISTRICT', 'ZONE');
-- Group collaboration roles:
--   OWNER  â†’ toÃ n quyá»n (edit metadata, add/remove/reorder places, invite, publish)
--   EDITOR â†’ tin cáº­y, edit trá»±c tiáº¿p places (add/remove/reorder), khÃ´ng sá»­a metadata/publish
--   VIEWER â†’ chá»‰ xem + Ä‘á» xuáº¥t qua proposals/votes, khÃ´ng write trá»±c tiáº¿p
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
-- 3. PHÃ‚N Há»† QUáº¢N LÃ NGÆ¯á»œI DÃ™NG & XÃC THá»°C (USER & AUTH)
-- =============================================================================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- [MED] citext tá»± Ä‘á»™ng so sÃ¡nh case-insensitive â€” trÃ¡nh trÃ¹ng tÃ i khoáº£n do hoa/thÆ°á»ng
    email         CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name     VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    phone_number  VARCHAR(20),
    role          user_role_enum DEFAULT 'USER',
    is_active     BOOLEAN DEFAULT true,
    is_verified   BOOLEAN DEFAULT false,
    verified_at   TIMESTAMP WITH TIME ZONE,
    -- [HIGH] Soft-delete: khÃ´ng xÃ³a váº­t lÃ½, trace Ä‘Æ°á»£c ai Ä‘Ã£ tá»«ng cÃ³ tÃ i khoáº£n
    deleted_at    TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Partial index: chá»‰ enforce uniqueness email trÃªn tÃ i khoáº£n chÆ°a bá»‹ soft-delete
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
-- 4. KHU Vá»°C DU Lá»ŠCH (TRAVEL AREAS)
-- =============================================================================

CREATE TABLE travel_areas (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    name_vi      VARCHAR(100),
    slug         VARCHAR(100) UNIQUE NOT NULL,
    -- [MED] Enum thay vÃ¬ VARCHAR tá»± do â€” nháº¥t quÃ¡n, trÃ¡nh typo
    type         area_type_enum NOT NULL,
    parent_id    INT REFERENCES travel_areas(id) ON DELETE SET NULL,
    bbox_min_lat DOUBLE PRECISION,
    bbox_max_lat DOUBLE PRECISION,
    bbox_min_lng DOUBLE PRECISION,
    bbox_max_lng DOUBLE PRECISION,
    -- [MED] CHECK: bbox há»£p lá»‡ náº¿u cÃ³
    CONSTRAINT chk_bbox_lat CHECK (bbox_min_lat IS NULL OR (bbox_min_lat >= -90  AND bbox_max_lat <= 90  AND bbox_min_lat < bbox_max_lat)),
    CONSTRAINT chk_bbox_lng CHECK (bbox_min_lng IS NULL OR (bbox_min_lng >= -180 AND bbox_max_lng <= 180 AND bbox_min_lng < bbox_max_lng)),
    boundary     GEOGRAPHY(POLYGON, 4326),
    is_active    BOOLEAN DEFAULT true
);

-- =============================================================================
-- 5. PHÃ‚N Há»† Äá»ŠA ÄIá»‚M & VECTOR SEARCH (PLACES & RAG DATA)
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
    -- [MED] Auto-populated bá»Ÿi trigger (unaccent + lower) â€” dÃ¹ng cho pg_trgm fuzzy search
    name_normalized VARCHAR(255),
    description     TEXT,
    category_id     INT REFERENCES categories(id) ON DELETE SET NULL,
    area_id         INT REFERENCES travel_areas(id) ON DELETE SET NULL,

    -- Äá»‹a chá»‰ text â€” derive tá»« area_id nhÆ°ng giá»¯ láº¡i Ä‘á»ƒ display
    -- [HIGH] KhÃ´ng cÃ³ DEFAULT 'Há»“ ChÃ­ Minh' â€” crawler PHáº¢I set Ä‘Ãºng giÃ¡ trá»‹
    address         TEXT NOT NULL,
    district        VARCHAR(100),
    city            VARCHAR(100),
    province        VARCHAR(100),
    country         VARCHAR(50) DEFAULT 'Vietnam',

    -- Tá»a Ä‘á»™
    -- [INTENTIONAL] Constraint giá»›i háº¡n lÃ£nh thá»• Viá»‡t Nam â€” quyáº¿t Ä‘á»‹nh product scope cÃ³ chá»§ Ä‘Ã­ch.
    -- Scope hiá»‡n táº¡i: Vietnam-only. Náº¿u má»Ÿ rá»™ng SEA: ALTER TABLE DROP CONSTRAINT (1 dÃ²ng migration).
    -- lat 8.0â€“23.5 (CÃ  Mau â†’ LÅ©ng CÃº), lng 102.0â€“110.0 (biÃªn giá»›i TÃ¢y â†’ HoÃ ng Sa)
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    CONSTRAINT chk_latitude  CHECK (latitude  BETWEEN  8.0 AND 23.5),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN 102.0 AND 110.0),
    location        GEOGRAPHY(POINT, 4326),  -- Auto-populated bá»Ÿi trigger

    -- GiÃ¡
    price_range     JSONB,
    -- [MED] price_level Ä‘Æ°á»£c derive vÃ  Ä‘á»“ng bá»™ tá»« price_range qua trigger
    -- KhÃ´ng tá»± Ã½ update price_level mÃ  khÃ´ng update price_range
    price_level     budget_level_enum,
    opening_hours   JSONB,

    -- LiÃªn há»‡
    phone           VARCHAR(30),
    website         TEXT,

    -- ÄÃ¡nh giÃ¡ (computed bá»Ÿi trigger)
    rating_avg      FLOAT DEFAULT 0.0 CHECK (rating_avg BETWEEN 0.0 AND 5.0),
    review_count    INT DEFAULT 0 CHECK (review_count >= 0),
    image_count     INT DEFAULT 0 CHECK (image_count >= 0),

    -- Tags & attributes
    tags            TEXT[] DEFAULT '{}',
    attributes      JSONB DEFAULT '{}',

    -- Tráº¡ng thÃ¡i
    status          place_status_enum DEFAULT 'ACTIVE',
    -- Khi dedup merge: place nÃ y lÃ  báº£n trÃ¹ng, point vá» place gá»‘c
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
    -- [MED] Truy váº¿t ai upload áº£nh â€” cáº§n cho kiá»ƒm duyá»‡t báº£n quyá»n
    uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    width         INT,
    height        INT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vector embedding 1:1 vá»›i places â€” tÃ¡ch báº£ng riÃªng vÃ¬ vector ~6KB/row
CREATE TABLE place_embeddings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id      UUID UNIQUE NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    content_text  TEXT NOT NULL,
    embedding     VECTOR(1536),
    model_name    VARCHAR(100),
    model_version VARCHAR(50),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data provenance: dedup theo external_id, sync Ä‘á»‹nh ká»³ tá»« provider
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
    -- Rating tá»« provider â€” KHÃ”NG overwrite places.rating_avg (internal review)
    source_rating       FLOAT CHECK (source_rating IS NULL OR source_rating BETWEEN 0.0 AND 5.0),
    source_review_count INT CHECK (source_review_count IS NULL OR source_review_count >= 0),
    CONSTRAINT uq_provider_external UNIQUE(provider, external_id)
);

-- =============================================================================
-- 6. PHÃ‚N Há»† ÄÃNH GIÃ & Bá»˜ SÆ¯U Táº¬P (REVIEWS & COLLECTIONS)
-- =============================================================================

-- PARTITION STRATEGY NOTE (Low priority â€” chuáº©n bá»‹ sáºµn):
-- Khi place_reviews Ä‘áº¡t >1M rows, cÃ¢n nháº¯c PARTITION BY RANGE(created_at)
-- VÃ­ dá»¥: partition theo nÄƒm (2024, 2025, 2026...)
CREATE TABLE place_reviews (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id      UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    -- [MED] CHECK: rating há»£p lá»‡ 1-5
    rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title         VARCHAR(255),
    comment       TEXT,
    images        TEXT[],
    visited_at    DATE,
    helpful_count INT DEFAULT 0 CHECK (helpful_count >= 0),
    -- [HIGH] Soft-delete: khÃ´ng xÃ³a review, Ä‘á»ƒ láº¡i dáº¥u váº¿t
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
-- 7. PHÃ‚N Há»† Láº¬P Káº¾ HOáº CH & TÆ¯Æ NG TÃC NHÃ“M (ITINERARIES & GROUPS)
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
    -- [MED] CHECK: end_date khÃ´ng trÆ°á»›c start_date
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

    -- Fractional ordering: reorder chá»‰ cáº§n UPDATE 1 row thay vÃ¬ renumber toÃ n bá»™
    -- VÃ­ dá»¥: chÃ¨n giá»¯a 1.0 vÃ  2.0 â†’ 1.5; chÃ¨n giá»¯a 1.0 vÃ  1.5 â†’ 1.25
    -- Khi precision cáº¡n (gap < 0.0001), client bulk re-normalize toÃ n bá»™ ngÃ y Ä‘Ã³
    -- KHÃ”NG dÃ¹ng UNIQUE constraint vÃ¬ concurrent reorder cÃ³ thá»ƒ táº¡o tie (cÃ¹ng giÃ¡ trá»‹)
    -- Tie-break á»Ÿ application: ORDER BY day_number, visit_order, created_at
    visit_order                DECIMAL(12, 6) NOT NULL,

    start_time                 TIME,
    end_time                   TIME,
    estimated_duration_minutes INT DEFAULT 60 CHECK (estimated_duration_minutes > 0),
    estimated_cost             DECIMAL(10, 2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    travel_distance_meters     INT CHECK (travel_distance_meters IS NULL OR travel_distance_meters >= 0),
    travel_duration_seconds    INT CHECK (travel_duration_seconds IS NULL OR travel_duration_seconds >= 0),
    notes                      TEXT,

    -- updated_at dÃ¹ng cho optimistic concurrency check (PATCH vá»›i last_seen_at)
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
    -- OWNER: toÃ n quyá»n (edit metadata, places, invite, publish)
    -- EDITOR: edit trá»±c tiáº¿p itinerary_destinations (add/remove/reorder), khÃ´ng sá»­a metadata
    -- VIEWER: read-only + Ä‘á» xuáº¥t qua group_place_proposals/votes
    -- NOTE: OWNER luÃ´n lÃ  creator ban Ä‘áº§u; chá»‰ OWNER má»›i Ä‘Æ°á»£c nÃ¢ng/háº¡ role ngÆ°á»i khÃ¡c
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
-- 8. PHÃ‚N Há»† AI AGENT & CHAT MEMORY (AGENTIC RAG CORE)
-- =============================================================================

-- PARTITION STRATEGY NOTE (Low priority):
-- Khi ai_chat_messages Ä‘áº¡t >5M rows, partition BY RANGE(created_at) theo thÃ¡ng
CREATE TABLE ai_chat_sessions (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                      VARCHAR(255) DEFAULT 'TrÃ² chuyá»‡n má»›i',
    summary                    TEXT,
    -- [MED] Intentionally NO FK constraint trÃªn last_summarized_message_id
    -- LÃ½ do: trÃ¡nh cascade issue khi messages bá»‹ cleanup/archive
    -- Trade-off: cÃ³ thá»ƒ trá» tá»›i message khÃ´ng cÃ²n tá»“n táº¡i â€” cháº¥p nháº­n Ä‘Æ°á»£c,
    -- app pháº£i handle gracefully khi fetch message nÃ y
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
-- 9. PHÃ‚N Há»† Cá»˜NG Äá»’NG (COMMUNITY POSTS & INTERACTIONS)
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
    -- [HIGH] Soft-delete: giá»¯ láº¡i record cho audit trail
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
    -- [HIGH] Soft-delete: khÃ´ng xÃ³a váº­t lÃ½ â€” giá»¯ thread, hiá»ƒn thá»‹ "[ÄÃ£ xÃ³a]"
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- [HIGH] Report/Moderation cho ná»™i dung cá»™ng Ä‘á»“ng
-- KhÃ´ng cÃ³ cÆ¡ cháº¿ nÃ y thÃ¬ khÃ´ng thá»ƒ váº­n hÃ nh khi cÃ³ ná»™i dung vi pháº¡m
CREATE TABLE content_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Polymorphic target: report cÃ³ thá»ƒ nháº¯m vÃ o post, comment, review, hoáº·c place
    -- CHECK constraint thay vÃ¬ FK vÃ¬ SQL khÃ´ng há»— trá»£ polymorphic FK
    target_type     VARCHAR(50) NOT NULL,
    CONSTRAINT chk_report_target_type CHECK (
        target_type IN ('post', 'comment', 'review', 'place')
    ),
    target_id       UUID NOT NULL,

    report_type     report_type_enum NOT NULL,
    description     TEXT,
    status          report_status_enum DEFAULT 'PENDING',

    -- Admin xá»­ lÃ½
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
-- Khi crawl_jobs Ä‘áº¡t >500K rows, archive jobs cÅ© sang crawl_jobs_archive
-- hoáº·c PARTITION BY RANGE(created_at) theo thÃ¡ng
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
-- 11. PHÃ‚N Há»† RAG â€” KNOWLEDGE BASE
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
-- 12. AUDIT TRAIL â€” ADMIN ACTIONS
-- [HIGH] Trace "ai Ä‘Ã£ lÃ m gÃ¬, lÃºc nÃ o, trÃªn Ä‘á»‘i tÆ°á»£ng nÃ o" â€” báº¯t buá»™c khi cÃ³ ADMIN role
-- =============================================================================

CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_role    user_role_enum NOT NULL,
    action        audit_action_enum NOT NULL,

    -- Polymorphic target
    -- CHECK constraint thay vÃ¬ FK vÃ¬ SQL khÃ´ng há»— trá»£ polymorphic FK
    target_type   VARCHAR(50) NOT NULL,
    CONSTRAINT chk_audit_target_type CHECK (
        target_type IN ('place', 'review', 'user', 'crawl_job',
                        'itinerary', 'community_post', 'post_comment')
    ),
    target_id     UUID,                   -- NULL cho actions khÃ´ng cÃ³ entity cá»¥ thá»ƒ
    target_label  TEXT,                   -- Human-readable: "NhÃ  hÃ ng ABC" (snapshot tÃªn lÃºc Ä‘Ã³)

    -- Payload: before/after state Ä‘á»ƒ cÃ³ thá»ƒ rollback hoáº·c audit
    before_data   JSONB,
    after_data    JSONB,

    -- Metadata
    ip_address    INET,
    user_agent    TEXT,
    notes         TEXT,

    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 13. Tá»I Æ¯U HÃ“A CHá»ˆ Má»¤C (INDEXES)
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

-- Soft-delete support (queries thÆ°á»ng chá»‰ cáº§n active records)
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

-- Trigger 1: Auto-populate PostGIS location tá»« lat/lng + normalize tÃªn
CREATE OR REPLACE FUNCTION fn_update_places_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    -- Auto-normalize tÃªn: bá» dáº¥u tiáº¿ng Viá»‡t, lowercase, trim
    -- DÃ¹ng cho pg_trgm fuzzy search & deduplication
    NEW.name_normalized = lower(trim(unaccent(NEW.name)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_places_location_name
BEFORE INSERT OR UPDATE OF latitude, longitude, name ON places
FOR EACH ROW EXECUTE FUNCTION fn_update_places_location();

-- Trigger 2: Auto-update rating_avg vÃ  review_count khi cÃ³ review má»›i / xÃ³a
-- Chá»‰ tÃ­nh review chÆ°a bá»‹ soft-delete
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

-- Trigger 3: [MED] Äá»“ng bá»™ price_level tá»« price_range
-- NgÆ°á»¡ng Ã¡p dá»¥ng CHá»ˆ KHI currency = 'VND'. Currency khÃ¡c â†’ price_level = NULL.
-- LÃ½ do: crawler quá»‘c táº¿ cÃ³ thá»ƒ tráº£ vá» USD, Ã¡p ngÆ°á»¡ng VND lÃªn USD sáº½ gÃ¢y silent bug.
-- Mapping VND:
--   < 100,000       â†’ LOW
--   100,000â€“300,000 â†’ MEDIUM
--   300,000â€“800,000 â†’ HIGH
--   > 800,000       â†’ LUXURY
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
            -- Currency khÃ¡c VND (USD, THB...) hoáº·c thiáº¿u currency field
            -- â†’ set NULL, Ä‘á»ƒ batch job riÃªng xá»­ lÃ½ conversion
            NEW.price_level := NULL;
        END IF;
    ELSE
        -- price_range NULL hoáº·c thiáº¿u min/max â†’ khÃ´ng derive
        NEW.price_level := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_price_level
BEFORE INSERT OR UPDATE OF price_range ON places
FOR EACH ROW EXECUTE FUNCTION fn_sync_price_level();

-- Trigger 5: Cháº·n xÃ³a/háº¡ quyá»n OWNER cuá»‘i cÃ¹ng cá»§a má»™t trip_group
-- Há»‡ quáº£ náº¿u khÃ´ng cÃ³ trigger: group khÃ´ng cÃ³ ai quáº£n trá»‹ â€” orphan group,
-- khÃ´ng thá»ƒ invite, khÃ´ng thá»ƒ publish â€” lá»—i váº­n hÃ nh im láº·ng.
CREATE OR REPLACE FUNCTION fn_prevent_ownerless_group()
RETURNS TRIGGER AS $$
BEGIN
    -- KÃ­ch hoáº¡t khi: xÃ³a OWNER, hoáº·c háº¡ OWNER xuá»‘ng EDITOR/VIEWER
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
                'trip_group % pháº£i cÃ³ Ã­t nháº¥t 1 OWNER. HÃ£y chuyá»ƒn quyá»n OWNER trÆ°á»›c khi rá»i nhÃ³m.',
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
-- 15. VIEWS â€” QUERY HELPERS
-- =============================================================================

-- active_places: View loáº¡i trá»« soft-deleted places
-- [Báº®TBUá»˜C] Má»i query ngÆ°á»i dÃ¹ng liÃªn quan places PHáº¢I dÃ¹ng view nÃ y thay vÃ¬ table trá»±c tiáº¿p.
-- LÃ½ do: khi places.deleted_at IS NOT NULL, cÃ¡c báº£ng con (place_reviews,
-- itinerary_destinations, collection_places) khÃ´ng tá»± pháº£n Ã¡nh vÃ¬ Ä‘Ã¢y lÃ  soft-delete
-- (FK CASCADE váº­t lÃ½ khÃ´ng kÃ­ch hoáº¡t). DÃ¹ng view nÃ y lÃ m base giÃºp trÃ¡nh má»—i dev
-- pháº£i tá»± thÃªm WHERE deleted_at IS NULL â€” dá»… sÃ³t, gÃ¢y rÃ² rá»‰ dá»¯ liá»‡u Ä‘Ã£ xÃ³a.
CREATE OR REPLACE VIEW active_places AS
    SELECT * FROM places
    WHERE deleted_at IS NULL
      AND status != 'DUPLICATE';   -- Loáº¡i cáº£ báº£n trÃ¹ng Ä‘Ã£ merge

-- =============================================================================
-- 16. DESIGN DECISIONS â€” GHI CHÃš KIáº¾N TRÃšC
-- =============================================================================

-- [1] FIELD-LEVEL UPDATE â€” MANDATORY CONVENTION
-- itinerary_destinations cho phÃ©p EDITOR vÃ  OWNER sá»­a trá»±c tiáº¿p.
-- Náº¿u application gá»­i full-object UPDATE (UPDATE ... SET col1=$1, col2=$2, col3=$3...),
-- 2 EDITOR sá»­a field khÃ¡c nhau cá»§a cÃ¹ng 1 row cÃ¹ng lÃºc sáº½ gÃ¢y SILENT DATA LOSS
-- (ngÆ°á»i sau ghi Ä‘Ã¨ toÃ n bá»™, ká»ƒ cáº£ field ngÆ°á»i trÆ°á»›c vá»«a sá»­a).
-- CONVENTION Báº®T BUá»˜C: Chá»‰ dÃ¹ng field-level PATCH, KHÃ”NG dÃ¹ng full-object PUT.
--   âœ… UPDATE itinerary_destinations SET notes = $1 WHERE id = $2
--   âœ… UPDATE itinerary_destinations SET start_time = $1 WHERE id = $2
--   âŒ UPDATE itinerary_destinations SET notes=$1, start_time=$2, ... WHERE id=$n
-- Xem thÃªm: ARCHITECTURE.md > Convention > Field-Level Update

-- [2] MERGED_INTO â€” INTENTIONAL REDIRECT STRATEGY (Option A: Application-level)
-- Khi place A bá»‹ merge vÃ o B (A.status = 'DUPLICATE', A.merged_into = B.id):
--   - place_reviews, itinerary_destinations, collection_places váº«n trá» vá» A
--   - ÄÃ¢y lÃ  INTENTIONAL: giá»¯ nguyÃªn lá»‹ch sá»­ ("tÃ´i Ä‘Ã£ Ä‘áº¿n nhÃ  hÃ ng ABC")
--   - Application layer chá»‹u trÃ¡ch nhiá»‡m redirect khi query:
--       SELECT COALESCE(p_merged.id, p.id) AS effective_place_id
--       FROM places p
--       LEFT JOIN places p_merged ON p.merged_into = p_merged.id
--       WHERE p.id = $1
--   - KHÃ”NG trigger auto-remap FK vÃ¬ máº¥t lá»‹ch sá»­, khÃ´ng rollback Ä‘Æ°á»£c
-- Xem thÃªm: ARCHITECTURE.md > Convention > Deduplication Redirect

-- [3] SOFT-DELETE PROPAGATION â€” REPOSITORY LAYER RESPONSIBILITY
-- Khi places.deleted_at IS NOT NULL (admin soft-delete):
--   - FK references trong báº£ng con (place_reviews, itinerary_destinations...) KHÃ”NG tá»± xÃ³a
--   - Má»i query cáº§n join places PHáº¢I dÃ¹ng active_places view hoáº·c thÃªm WHERE places.deleted_at IS NULL
--   - TrÃ¡ch nhiá»‡m nÃ y thuá»™c vá» service/repository layer, KHÃ”NG pháº£i DB schema
-- Convention: Táº¥t cáº£ PlaceRepository method máº·c Ä‘á»‹nh query tá»« active_places,
--   chá»‰ dÃ¹ng places trá»±c tiáº¿p cho ADMIN endpoints cáº§n xem cáº£ deleted records.
-- Xem thÃªm: ARCHITECTURE.md > Convention > Soft-Delete Propagation

-- NOTE: version column vÃ  optimistic locking KHÃ”NG Ã¡p dá»¥ng cho itineraries/itinerary_destinations
-- LÃ½ do:
--   1. itineraries â€” chá»‰ OWNER má»›i sá»­a metadata â†’ single-writer, khÃ´ng conflict
--   2. itinerary_destinations â€” má»—i place lÃ  1 row riÃªng; EDITOR add/remove khÃ´ng Ä‘á»¥ng nhau;
--      reorder dÃ¹ng fractional DECIMAL â†’ chá»‰ UPDATE 1 row, khÃ´ng cascade renumber
--   3. Conflict thá»±c táº¿ (xÃ³a Ä‘Ãºng 1 place cÃ¹ng lÃºc) â†’ last-write-wins cháº¥p nháº­n Ä‘Æ°á»£c
--   4. updated_at Ä‘á»§ lÃ m lightweight conflict hint náº¿u cáº§n á»Ÿ tÆ°Æ¡ng lai

