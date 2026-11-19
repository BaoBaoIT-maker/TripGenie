-- CreateTable: itinerary_lodgings (one row per night of an itinerary)
CREATE TABLE IF NOT EXISTS "itinerary_lodgings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "itinerary_id" UUID NOT NULL,
    "night_number" INTEGER NOT NULL,
    "place_id" UUID NOT NULL,
    "is_auto_suggested" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_lodgings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "itinerary_lodgings_itinerary_id_night_number_key"
  ON "itinerary_lodgings"("itinerary_id", "night_number");

CREATE INDEX IF NOT EXISTS "itinerary_lodgings_place_id_idx"
  ON "itinerary_lodgings"("place_id");

-- AddForeignKey
ALTER TABLE "itinerary_lodgings"
  ADD CONSTRAINT "itinerary_lodgings_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itinerary_lodgings"
  ADD CONSTRAINT "itinerary_lodgings_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "places"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
