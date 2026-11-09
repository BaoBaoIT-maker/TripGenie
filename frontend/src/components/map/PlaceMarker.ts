import type { DiscoveryPlace, NearbyPlace } from "@/features/map/types";

export interface PlaceMarkerOptions {
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (placeId: string) => void;
  /** Sequential number label (e.g. "1", "2"). When set, renders bold number with custom/day bg instead of category icon. */
  label?: string;
  /** Custom background color for marker pin (e.g. day color hex like #0D9488, #6366F1) */
  customColor?: string;
}

interface CategoryStyle {
  bg: string;
  stemBorderClass: string;
  iconHtml: string;
}

// Clean Font Awesome 6 icons matching standard map categories
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  cafe: {
    bg: "bg-amber-700 text-white",
    stemBorderClass: "border-t-amber-700",
    iconHtml: `<i class="fa-solid fa-mug-saucer text-[11px] leading-none"></i>`,
  },
  "ca-phe": {
    bg: "bg-amber-700 text-white",
    stemBorderClass: "border-t-amber-700",
    iconHtml: `<i class="fa-solid fa-mug-saucer text-[11px] leading-none"></i>`,
  },
  restaurant: {
    bg: "bg-orange-600 text-white",
    stemBorderClass: "border-t-orange-600",
    iconHtml: `<i class="fa-solid fa-utensils text-[11px] leading-none"></i>`,
  },
  "nha-hang": {
    bg: "bg-orange-600 text-white",
    stemBorderClass: "border-t-orange-600",
    iconHtml: `<i class="fa-solid fa-utensils text-[11px] leading-none"></i>`,
  },
  sightseeing: {
    bg: "bg-blue-600 text-white",
    stemBorderClass: "border-t-blue-600",
    iconHtml: `<i class="fa-solid fa-landmark text-[11px] leading-none"></i>`,
  },
  "diem-tham-quan": {
    bg: "bg-blue-600 text-white",
    stemBorderClass: "border-t-blue-600",
    iconHtml: `<i class="fa-solid fa-landmark text-[11px] leading-none"></i>`,
  },
  culture: {
    bg: "bg-indigo-600 text-white",
    stemBorderClass: "border-t-indigo-600",
    iconHtml: `<i class="fa-solid fa-landmark text-[11px] leading-none"></i>`,
  },
  nature: {
    bg: "bg-emerald-600 text-white",
    stemBorderClass: "border-t-emerald-600",
    iconHtml: `<i class="fa-solid fa-mountain-sun text-[11px] leading-none"></i>`,
  },
  "thien-nhien": {
    bg: "bg-emerald-600 text-white",
    stemBorderClass: "border-t-emerald-600",
    iconHtml: `<i class="fa-solid fa-mountain-sun text-[11px] leading-none"></i>`,
  },
  "bai-bien": {
    bg: "bg-teal-600 text-white",
    stemBorderClass: "border-t-teal-600",
    iconHtml: `<i class="fa-solid fa-umbrella-beach text-[11px] leading-none"></i>`,
  },
  entertainment: {
    bg: "bg-purple-600 text-white",
    stemBorderClass: "border-t-purple-600",
    iconHtml: `<i class="fa-solid fa-ticket text-[11px] leading-none"></i>`,
  },
  "vui-choi": {
    bg: "bg-purple-600 text-white",
    stemBorderClass: "border-t-purple-600",
    iconHtml: `<i class="fa-solid fa-ticket text-[11px] leading-none"></i>`,
  },
  relaxation: {
    bg: "bg-rose-600 text-white",
    stemBorderClass: "border-t-rose-600",
    iconHtml: `<i class="fa-solid fa-bed text-[11px] leading-none"></i>`,
  },
  "khach-san": {
    bg: "bg-rose-600 text-white",
    stemBorderClass: "border-t-rose-600",
    iconHtml: `<i class="fa-solid fa-bed text-[11px] leading-none"></i>`,
  },
  nightlife: {
    bg: "bg-fuchsia-600 text-white",
    stemBorderClass: "border-t-fuchsia-600",
    iconHtml: `<i class="fa-solid fa-martini-glass-citrus text-[11px] leading-none"></i>`,
  },
  "bar-pub": {
    bg: "bg-fuchsia-600 text-white",
    stemBorderClass: "border-t-fuchsia-600",
    iconHtml: `<i class="fa-solid fa-martini-glass-citrus text-[11px] leading-none"></i>`,
  },
};

const DEFAULT_STYLE: CategoryStyle = {
  bg: "bg-[#0194F3] text-white",
  stemBorderClass: "border-t-[#0194F3]",
  iconHtml: `<i class="fa-solid fa-location-dot text-[11px] leading-none"></i>`,
};

export function getCategoryStyle(categoryKey?: string): CategoryStyle {
  if (!categoryKey) return DEFAULT_STYLE;
  const key = categoryKey.toLowerCase();
  return CATEGORY_STYLES[key] || DEFAULT_STYLE;
}

export function getMarkerButtonClasses(selected: boolean, hovered: boolean, categoryBg?: string): string {
  const bg = categoryBg || "bg-[#0194F3] text-white";
  return [
    "relative flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer select-none border-2 border-white shadow-md",
    bg,
    selected
      ? "z-30 scale-125 ring-4 ring-[#0194F3]/40 shadow-xl size-8"
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
  // When a sequential label is provided (itinerary mode), use customColor if supplied, else slate-900 bg
  const style = options.label
    ? {
        bg: options.customColor ? "" : "bg-slate-900 text-white",
        stemBorderClass: options.customColor ? "" : "border-t-slate-900",
        iconHtml: "",
      }
    : getCategoryStyle(place.category);

  // Outer container: coordinates managed strictly by MapLibre
  const container = document.createElement("div");
  container.className = "marker-container relative flex flex-col items-center pointer-events-auto cursor-pointer group -translate-y-1/2";
  container.dataset.placeId = place.id;

  // Name tooltip chip (appears on hover or when selected)
  const nameTooltip = document.createElement("div");
  nameTooltip.className = `absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-white/95 border border-slate-200 text-slate-800 text-[10px] font-bold shadow-md whitespace-nowrap pointer-events-none transition-all duration-150 ${
    options.selected
      ? "hidden"
      : options.hovered
        ? "opacity-100 scale-100 z-30"
        : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 z-20"
  }`;
  nameTooltip.textContent = place.name;
  container.appendChild(nameTooltip);

  // Inner button with category color & icon
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Xem ${place.name} trên bản đồ`);
  button.dataset.active = options.selected ? "true" : "false";
  button.dataset.categoryBg = style.bg;
  if (options.customColor) {
    button.dataset.customColor = options.customColor;
  }
  button.className = getMarkerButtonClasses(Boolean(options.selected), Boolean(options.hovered), style.bg);

  if (options.customColor) {
    button.style.backgroundColor = options.customColor;
    button.style.borderColor = "#ffffff";
    button.style.color = "#ffffff";
  }

  if (options.label) {
    button.textContent = options.label;
    button.style.fontWeight = "700";
    button.style.fontSize = "11px";
  } else {
    button.innerHTML = style.iconHtml;
  }

  // Tiny bottom pointer stem for exact location pinpointing (optical alignment)
  const stem = document.createElement("div");
  stem.className =
    "absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] shadow-xs pointer-events-none";
  if (options.customColor) {
    stem.style.borderTopColor = options.customColor;
  } else if (style.stemBorderClass) {
    stem.className += " " + style.stemBorderClass;
  } else {
    stem.className += " border-t-white";
  }

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
