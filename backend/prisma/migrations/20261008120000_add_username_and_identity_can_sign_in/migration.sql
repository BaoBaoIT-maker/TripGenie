-- Migration: Add username, make email nullable, add can_sign_in to user_identities
-- Safe, additive migration that preserves all existing user records and relations.

-- 1. Add username column to users table if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(50);

-- 2. Make email nullable to support username-only registrations
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- 3. Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- 4. Add can_sign_in flag to user_identities table (defaults to true for existing rows)
ALTER TABLE "user_identities" ADD COLUMN IF NOT EXISTS "can_sign_in" BOOLEAN NOT NULL DEFAULT true;

-- 5. Ensure auth_version column exists with default 0
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_version" INTEGER NOT NULL DEFAULT 0;
