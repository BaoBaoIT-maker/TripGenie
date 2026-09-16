import type { NearbyPlace } from "@/features/map/types";
import { formatDistanceKm } from "@/features/map/lib/map-filter";

export function createMapPopupElement(nearbyPlace: NearbyPlace): HTMLDivElement {
  const { place, distanceKm } = nearbyPlace;

  const container = document.createElement("div");
  container.className = "p-3 max-w-xs space-y-2 text-sm font-sans";

  // Category and distance badge row
  const header = document.createElement("div");
  header.className = "flex items-center justify-between gap-2 text-xs";

  const categorySpan = document.createElement("span");
  categorySpan.className = "font-medium text-primary";
  categorySpan.textContent = place.categoryLabel || place.category;
  header.appendChild(categorySpan);

  const distanceSpan = document.createElement("span");
  distanceSpan.className = "rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary text-xs";
  distanceSpan.textContent = formatDistanceKm(distanceKm);
  header.appendChild(distanceSpan);

  container.appendChild(header);

  // Place title
  const title = document.createElement("h4");
  title.className = "font-semibold text-foreground text-sm line-clamp-1 leading-snug";
  title.textContent = place.name;
  container.appendChild(title);

  // Address
  const address = document.createElement("p");
  address.className = "text-xs text-muted-foreground line-clamp-2";
  address.textContent = place.address;
  container.appendChild(address);

  // Rating if available
  if (place.rating) {
    const ratingRow = document.createElement("div");
    ratingRow.className = "flex items-center gap-1 text-xs font-medium text-amber-600";
    ratingRow.textContent = `★ ${place.rating} (${place.reviewCount ?? 0} đánh giá)`;
    container.appendChild(ratingRow);
  }

  // Link to details
  const link = document.createElement("a");
  link.href = `/places/${place.slug}`;
  link.className = "inline-flex items-center justify-center w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-1";
  link.textContent = "Xem chi tiết";
  container.appendChild(link);

  return container;
}
