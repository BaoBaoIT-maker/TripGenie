import type { DiscoveryPlace, NearbyPlace } from "@/features/map/types";

export interface PlaceMarkerOptions {
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (placeId: string) => void;
}

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  "ca-phe": "☕",
  "nha-hang": "🍜",
  "bai-bien": "🏖️",
  "diem-tham-quan": "🏛️",
  "khach-san": "🏨",
  "bar-pub": "🍸",
  "an-vat": "🍢",
  cafe: "☕",
  restaurant: "🍜",
  sightseeing: "🏛️",
  nature: "🌿",
  entertainment: "🎡",
};

export function getMarkerButtonClasses(selected: boolean, hovered: boolean): string {
  return [
    "relative flex items-center justify-center rounded-full transition-transform duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary select-none",
    selected
      ? "z-30 scale-125 bg-primary text-primary-foreground shadow-xl ring-2 ring-white w-9 h-9"
      : hovered
        ? "z-20 scale-110 bg-primary/90 text-primary-foreground shadow-lg ring-2 ring-primary/30 w-8 h-8"
        : "z-10 bg-white text-primary border border-primary/40 shadow-md w-7 h-7 hover:scale-110",
  ].join(" ");
}

export function createPlaceMarkerElement(
  item: NearbyPlace | DiscoveryPlace,
  options: PlaceMarkerOptions = {}
): { container: HTMLDivElement; button: HTMLButtonElement } {
  const place = "place" in item ? item.place : item;

  // Outer container: coordinates managed strictly by MapLibre (no custom CSS transform on this)
  const container = document.createElement("div");
  container.className = "marker-container relative flex items-center justify-center pointer-events-auto cursor-pointer";
  container.dataset.placeId = place.id;

  // Inner button: safe to scale and style without clashing with MapLibre's translate(x, y)
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Xem ${place.name} trên bản đồ`);
  button.dataset.active = options.selected ? "true" : "false";
  button.className = getMarkerButtonClasses(Boolean(options.selected), Boolean(options.hovered));

  const icon = document.createElement("span");
  icon.className = "flex items-center justify-center text-xs font-bold pointer-events-none select-none";
  icon.textContent = CATEGORY_EMOJI_MAP[place.category] || "📍";
  button.appendChild(icon);

  if (options.onSelect) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onSelect!(place.id);
    });
  }

  container.appendChild(button);
  return { container, button };
}
