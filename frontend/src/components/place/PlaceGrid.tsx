import { Place } from "@/types/place";
import { PlaceCard } from "./PlaceCard";
import { cn } from "@/lib/utils";

interface PlaceGridProps {
  places: Place[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function PlaceGrid({
  places,
  columns = 3,
  className,
}: PlaceGridProps) {
  const colClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-5 sm:gap-6", colClasses[columns], className)}>
      {places.map((place) => (
        <PlaceCard key={place.id} place={place} />
      ))}
    </div>
  );
}
