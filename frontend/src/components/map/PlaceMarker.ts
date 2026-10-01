import type { DiscoveryPlace, NearbyPlace } from "@/features/map/types";

export interface PlaceMarkerOptions {
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (placeId: string) => void;
}

interface CategoryStyle {
  bg: string;
  svgIcon: string;
}

// Clean inline vector SVG icons (Google Maps / Apple Maps style)
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  cafe: {
    bg: "bg-amber-700 text-white",
    // Coffee cup
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
  },
  "ca-phe": {
    bg: "bg-amber-700 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
  },
  restaurant: {
    bg: "bg-orange-600 text-white",
    // Utensils
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  },
  "nha-hang": {
    bg: "bg-orange-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  },
  sightseeing: {
    bg: "bg-blue-600 text-white",
    // Landmark temple
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="22" y2="22"/><line x1="4" x2="20" y1="18" y2="18"/><path d="m12 2 8 6H4z"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/></svg>`,
  },
  "diem-tham-quan": {
    bg: "bg-blue-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="22" y2="22"/><line x1="4" x2="20" y1="18" y2="18"/><path d="m12 2 8 6H4z"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/></svg>`,
  },
  culture: {
    bg: "bg-indigo-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="22" y2="22"/><line x1="4" x2="20" y1="18" y2="18"/><path d="m12 2 8 6H4z"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/></svg>`,
  },
  nature: {
    bg: "bg-emerald-600 text-white",
    // Mountain
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
  },
  "thien-nhien": {
    bg: "bg-emerald-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
  },
  "bai-bien": {
    bg: "bg-teal-600 text-white",
    // Waves
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
  },
  entertainment: {
    bg: "bg-purple-600 text-white",
    // Sparkles / Star
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  "vui-choi": {
    bg: "bg-purple-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  relaxation: {
    bg: "bg-rose-600 text-white",
    // Bed / Hotel
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  },
  "khach-san": {
    bg: "bg-rose-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  },
  nightlife: {
    bg: "bg-fuchsia-600 text-white",
    // Wine
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
  },
  "bar-pub": {
    bg: "bg-fuchsia-600 text-white",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
  },
};

const DEFAULT_STYLE: CategoryStyle = {
  bg: "bg-sky-600 text-white",
  svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
};

export function getCategoryStyle(categoryKey?: string): CategoryStyle {
  if (!categoryKey) return DEFAULT_STYLE;
  const key = categoryKey.toLowerCase();
  return CATEGORY_STYLES[key] || DEFAULT_STYLE;
}

export function getMarkerButtonClasses(selected: boolean, hovered: boolean, categoryBg?: string): string {
  const bg = categoryBg || "bg-sky-600 text-white";
  return [
    "relative flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer select-none border-2 border-white shadow-md",
    bg,
    selected
      ? "z-30 scale-125 ring-4 ring-primary/40 shadow-xl size-8"
      : hovered
        ? "z-20 scale-115 ring-2 ring-black/20 shadow-lg size-7"
        : "z-10 size-6.5 hover:scale-115 hover:shadow-lg",
  ].join(" ");
}

export function createPlaceMarkerElement(
  item: NearbyPlace | DiscoveryPlace,
  options: PlaceMarkerOptions = {}
): { container: HTMLDivElement; button: HTMLButtonElement } {
  const place = "place" in item ? item.place : item;
  const style = getCategoryStyle(place.category);

  // Outer container: coordinates managed strictly by MapLibre
  const container = document.createElement("div");
  container.className = "marker-container relative flex flex-col items-center pointer-events-auto cursor-pointer group -translate-y-1/2";
  container.dataset.placeId = place.id;

  // Name tooltip chip (appears on hover or when selected)
  const nameTooltip = document.createElement("div");
  nameTooltip.className = `absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-background/95 border border-border/80 text-foreground text-[10px] font-bold shadow-md whitespace-nowrap pointer-events-none transition-all duration-150 ${
    options.selected
      ? "opacity-100 scale-100 z-40"
      : options.hovered
        ? "opacity-100 scale-100 z-30"
        : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 z-20"
  }`;
  nameTooltip.textContent = place.name;
  container.appendChild(nameTooltip);

  // Inner button with category color & SVG icon
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Xem ${place.name} trên bản đồ`);
  button.dataset.active = options.selected ? "true" : "false";
  button.dataset.categoryBg = style.bg;
  button.className = getMarkerButtonClasses(Boolean(options.selected), Boolean(options.hovered), style.bg);
  button.innerHTML = style.svgIcon;

  // Tiny bottom pointer stem for exact location pinpointing
  const stem = document.createElement("div");
  stem.className = "w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4px] border-t-white -mt-[1px] shadow-xs";

  button.appendChild(stem);

  if (options.onSelect) {
    container.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onSelect!(place.id);
    });
  }

  container.appendChild(button);
  return { container, button };
}
