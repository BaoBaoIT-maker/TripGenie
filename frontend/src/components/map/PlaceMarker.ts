import type { NearbyPlace } from "@/features/map/types";

export interface PlaceMarkerOptions {
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (placeId: string) => void;
}

export function createPlaceMarkerElement(
  nearbyPlace: NearbyPlace,
  options: PlaceMarkerOptions = {}
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Xem ${nearbyPlace.place.name} trên bản đồ`);
  button.dataset.active = options.selected ? "true" : "false";

  button.className = [
    "group relative flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500",
    options.selected
      ? "z-30 scale-125 bg-orange-600 text-white shadow-xl ring-2 ring-white w-9 h-9"
      : options.hovered
        ? "z-20 scale-110 bg-orange-500 text-white shadow-lg ring-2 ring-orange-200 w-8 h-8"
        : "z-10 bg-white text-orange-600 border border-orange-300 shadow-md w-7 h-7 hover:scale-110",
  ].join(" ");

  const icon = document.createElement("span");
  icon.className = "flex items-center justify-center text-xs font-bold pointer-events-none select-none";
  icon.textContent = "📍";
  button.appendChild(icon);

  if (options.onSelect) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onSelect!(nearbyPlace.place.id);
    });
  }

  return button;
}
