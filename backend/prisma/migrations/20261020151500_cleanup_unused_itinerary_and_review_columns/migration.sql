-- Migration: Cleanup unused columns across itineraries, itinerary_destinations, place_reviews, and place_images

-- 1. Table: itineraries (drop ai_prompt)
ALTER TABLE itineraries DROP COLUMN IF EXISTS ai_prompt;

-- 2. Table: itinerary_destinations (drop travel_distance_meters, travel_duration_seconds)
ALTER TABLE itinerary_destinations DROP COLUMN IF EXISTS travel_distance_meters;
ALTER TABLE itinerary_destinations DROP COLUMN IF EXISTS travel_duration_seconds;

-- 3. Table: place_reviews (drop visited_at)
ALTER TABLE place_reviews DROP COLUMN IF EXISTS visited_at;

-- 4. Table: place_images (drop uploaded_by with any referencing constraints)
ALTER TABLE place_images DROP COLUMN IF EXISTS uploaded_by CASCADE;
