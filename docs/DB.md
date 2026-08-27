-- =============================================================================
-- 1. KÍCH HOẠT CÁC EXTENSION CẦN THIẾT
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";   -- Spatial Query
CREATE EXTENSION IF NOT EXISTS "vector";    -- Vector Embedding (Agentic RAG)

-- =============================================================================
-- 2. TẠO CÁC KIỂU DỮ LIỆU ENUM
-- =============================================================================
CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'USER');
CREATE TYPE auth_provider_enum AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK', 'GITHUB');
CREATE TYPE budget_level_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'LUXURY');
CREATE TYPE place_status_enum AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');
CREATE TYPE chat_sender_enum AS ENUM ('USER', 'AGENT', 'TOOL');

-- =============================================================================
-- 3. PHÂN HỆ QUẢN LÝ NGƯỜI DÙNG & XÁC THỰC (USER & AUTH)
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone_number VARCHAR(20),
    role user_role_enum DEFAULT 'USER',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider auth_provider_enum NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    identity_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_provider_user UNIQUE(provider, provider_user_id)
);

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dietary_restrictions TEXT[],
    preferred_categories TEXT[],
    budget_level budget_level_enum DEFAULT 'MEDIUM',
    travel_style TEXT[],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. PHÂN HỆ ĐỊA ĐIỂM & VECTOR SEARCH (PLACES & RAG DATA)
-- =============================================================================

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon_url TEXT
);

CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    address TEXT NOT NULL,
    district VARCHAR(100),
    city VARCHAR(100) DEFAULT 'Hồ Chí Minh',
    
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    
    price_range JSONB,     -- `{ "min": 30000, "max": 150000, "currency": "VND" }`
    opening_hours JSONB,   -- `{ "monday": { "open": "07:00", "close": "22:00" }, ... }`
    rating_avg FLOAT DEFAULT 0.0,
    review_count INT DEFAULT 0,
    status place_status_enum DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE place_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE place_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID UNIQUE NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    content_chunk TEXT NOT NULL,
    embedding VECTOR(1536),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. PHÂN HỆ ĐÁNH GIÁ & BỘ SƯ TẬP (REVIEWS & COLLECTIONS)
-- =============================================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_place_review UNIQUE(user_id, place_id)
);

CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_places (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, place_id)
);

-- =============================================================================
-- 6. PHÂN HỆ LẬP KẾ HOẠCH & TƯƠNG TÁC NHÓM (ITINERARIES & GROUPS)
-- =============================================================================

CREATE TABLE itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    total_budget DECIMAL(12, 2),
    is_public BOOLEAN DEFAULT false,
    is_ai_generated BOOLEAN DEFAULT false,
    cloned_from_id UUID REFERENCES itineraries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE itinerary_destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    day_number INT DEFAULT 1,
    visit_order INT NOT NULL,
    start_time TIME,
    end_time TIME,
    estimated_cost DECIMAL(10, 2),
    travel_distance_meters INT,
    travel_duration_seconds INT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trip_group_id, user_id)
);

CREATE TABLE group_place_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    proposed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_group_place_proposal UNIQUE(trip_group_id, place_id)
);

CREATE TABLE group_place_votes (
    proposal_id UUID REFERENCES group_place_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (proposal_id, user_id)
);

-- =============================================================================
-- 7. PHÂN HỆ AI AGENT LOGS & CHAT MEMORY (AGENTIC RAG CORE)
-- =============================================================================

CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Trò chuyện mới',
    summary TEXT,
    last_summarized_message_id UUID, -- Checkpoint marker, không dùng FK constraint
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    sender chat_sender_enum NOT NULL,
    content TEXT,
    tool_calls JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. PHÂN HỆ CỘNG ĐỒNG (COMMUNITY POSTS & INTERACTIONS)
-- =============================================================================

CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    itinerary_id UUID UNIQUE NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    caption TEXT,
    like_count INT NOT NULL DEFAULT 0,
    clone_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 9. TỐI ƯU HÓA CHỈ MỤC (INDEXES)
-- =============================================================================

-- Spatial & Vector Indexes
CREATE INDEX idx_places_location ON places USING GIST (location);
CREATE INDEX idx_place_embeddings_hnsw ON place_embeddings USING hnsw (embedding vector_cosine_ops);

-- Places & Images Indexes
CREATE INDEX idx_places_category ON places(category_id);
CREATE INDEX idx_places_district ON places(district);
CREATE INDEX idx_place_images_place ON place_images(place_id);

-- Composite Index phục vụ Query Lịch Trình (Tối ưu ORDER BY day_number, visit_order)
CREATE INDEX idx_itinerary_destinations_order ON itinerary_destinations(itinerary_id, day_number, visit_order);

-- Community & Feed Indexes (Cursor Pagination & Access Patterns)
CREATE INDEX idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_user_created ON community_posts(user_id, created_at DESC);
CREATE INDEX idx_post_comments_post_created ON post_comments(post_id, created_at DESC);

-- Foreign Key Indexes cho JOIN / Filter
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_place ON reviews(place_id);
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_itineraries_creator ON itineraries(creator_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_proposals_group ON group_place_proposals(trip_group_id);
CREATE INDEX idx_group_proposals_place ON group_place_proposals(place_id);
CREATE INDEX idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_messages_session ON ai_chat_messages(session_id);

-- =============================================================================
-- 10. TRIGGERS
-- =============================================================================

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


