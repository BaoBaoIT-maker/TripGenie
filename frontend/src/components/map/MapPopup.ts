import type { DiscoveryPlace, NearbyPlace } from "@/features/map/types";
import { routingService } from "@/services/routing.service";

export function createMapPopupElement(
  item: NearbyPlace | DiscoveryPlace,
  onOpenDetail?: (placeId: string) => void,
  onRequestDirections?: (place: DiscoveryPlace) => void
): HTMLDivElement {
  const place = "place" in item ? item.place : item;
  const distanceKm = "distanceKm" in item ? item.distanceKm : undefined;

  const container = document.createElement("div");
  container.className = "p-3 max-w-[280px] space-y-2 text-sm font-sans";

  // Thumbnail image if available
  const placeImage = "coverImage" in place ? place.coverImage : place.primaryImage;
  if (placeImage) {
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "w-full h-24 overflow-hidden rounded-lg bg-muted relative mb-2";
    const img = document.createElement("img");
    img.src = placeImage;
    img.alt = place.name;
    img.className = "w-full h-full object-cover";
    img.loading = "lazy";
    img.onerror = () => { imgWrapper.remove(); };
    imgWrapper.appendChild(img);
    container.appendChild(imgWrapper);
  }

  // Category and distance badge row
  const header = document.createElement("div");
  header.className = "flex items-center justify-between gap-2 text-xs";

  const categorySpan = document.createElement("span");
  categorySpan.className = "font-medium text-primary text-[11px]";
  categorySpan.textContent = place.categoryLabel || place.category;
  header.appendChild(categorySpan);

  if (distanceKm !== undefined && distanceKm !== null) {
    const distanceSpan = document.createElement("span");
    distanceSpan.className = "rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary text-[11px]";
    distanceSpan.textContent = `📍 ${routingService.formatDistanceKm(distanceKm)}`;
    header.appendChild(distanceSpan);
  }

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

  // Action Buttons: "Chỉ đường" (Primary) & "Chi tiết" (Outline)
  const actionsRow = document.createElement("div");
  actionsRow.className = "grid grid-cols-2 gap-2 pt-1";

  // Directions button
  const dirBtn = document.createElement("button");
  dirBtn.type = "button";
  dirBtn.className = "inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs";
  dirBtn.innerHTML = `<span>🧭</span><span>Chỉ đường</span>`;
  if (onRequestDirections) {
    dirBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onRequestDirections(place as DiscoveryPlace);
    });
  }
  actionsRow.appendChild(dirBtn);

  // Link to details
  const link = document.createElement("a");
  link.href = `/places/${place.slug}`;
  link.className = "inline-flex items-center justify-center rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors";
  link.textContent = "Chi tiết →";
  if (onOpenDetail) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      onOpenDetail(place.id);
    });
  }
  actionsRow.appendChild(link);

  container.appendChild(actionsRow);

  return container;
}
