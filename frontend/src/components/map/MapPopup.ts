import type { DiscoveryPlace, NearbyPlace } from "@/features/map/types";
import { routingService } from "@/services/routing.service";

export function createMapPopupElement(
  item: NearbyPlace | DiscoveryPlace,
  onOpenDetail?: (placeId: string) => void,
  onRequestDirections?: (place: DiscoveryPlace) => void,
  options?: {
    isRoutingActive?: boolean;
    routeStopIndex?: number;
    isSaved?: boolean;
    onToggleSave?: (place: DiscoveryPlace) => void;
    onAddToItinerary?: (place: DiscoveryPlace) => void;
    onAddStopToRoute?: (place: DiscoveryPlace) => void;
    onRemoveStopFromRoute?: (placeId: string) => void;
    onSetOrigin?: (place: DiscoveryPlace) => void;
  }
): HTMLDivElement {
  const place = "place" in item ? item.place : item;
  const distanceKm = "distanceKm" in item ? item.distanceKm : undefined;

  const container = document.createElement("div");
  container.className = "w-[290px] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl font-sans select-none border border-slate-200/80";

  // 1. Header Image or Neutral Placeholder
  const dbImage =
    ("coverImage" in place && typeof place.coverImage === "string" && place.coverImage.trim() ? place.coverImage.trim() : null) ||
    ("primaryImage" in place && typeof place.primaryImage === "string" && place.primaryImage.trim() ? place.primaryImage.trim() : null) ||
    (Array.isArray(place.images) && place.images.length > 0 && typeof place.images[0] === "string" && place.images[0].trim() ? place.images[0].trim() : null);

  const imgWrapper = document.createElement("div");
  imgWrapper.className = "relative w-full h-32 bg-slate-100 overflow-hidden group cursor-pointer";
  if (onOpenDetail) {
    imgWrapper.addEventListener("click", () => onOpenDetail(place.id));
  }

  if (dbImage) {
    // Render authentic database image
    const img = document.createElement("img");
    img.src = dbImage;
    img.alt = place.name;
    img.className = "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      // If authentic image URL is dead (404), replace with clean placeholder
      imgWrapper.innerHTML = `
        <div class="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-3 text-center">
          <div class="size-8 rounded-full bg-white shadow-xs flex items-center justify-center text-slate-400 mb-1">
            <i class="fa-solid fa-camera text-sm"></i>
          </div>
          <span class="text-xs font-semibold text-slate-700">Chưa có ảnh thực tế</span>
          <span class="text-[10px] text-slate-400">${place.categoryLabel || place.category}</span>
        </div>
      `;
    };
    imgWrapper.appendChild(img);

    // Gradient scrim for text contrast
    const scrim = document.createElement("div");
    scrim.className = "absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none";
    imgWrapper.appendChild(scrim);
  } else {
    // Neutral Graphic Placeholder (matches PlaceCard.tsx pattern - no fake photos)
    const placeholder = document.createElement("div");
    placeholder.className = "w-full h-full bg-slate-100 flex flex-col items-center justify-center p-3 text-center";
    placeholder.innerHTML = `
      <div class="size-9 rounded-full bg-white shadow-xs flex items-center justify-center text-slate-400 mb-1">
        <i class="fa-solid fa-camera text-base"></i>
      </div>
      <span class="text-xs font-semibold text-slate-700">Chưa có ảnh thực tế</span>
      <span class="text-[10.5px] text-slate-400 font-medium">${place.categoryLabel || place.category}</span>
    `;
    imgWrapper.appendChild(placeholder);
  }

  // Floating Category pill on bottom-left of photo
  const categoryPill = document.createElement("span");
  categoryPill.className = "absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10.5px] font-semibold border border-white/20";
  categoryPill.textContent = place.categoryLabel || place.category;
  imgWrapper.appendChild(categoryPill);

  // Floating Quick Save button on top-left of photo
  if (options?.onToggleSave) {
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = `absolute top-2 left-2 size-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
      options.isSaved
        ? "bg-rose-500 text-white ring-2 ring-white/50 scale-105"
        : "bg-black/40 hover:bg-black/65 backdrop-blur-md text-white/90 hover:text-white"
    }`;
    saveBtn.title = options.isSaved ? "Bỏ lưu địa điểm" : "Lưu vào mục Yêu thích";
    saveBtn.innerHTML = `<i class="fa-solid fa-heart text-xs ${options.isSaved ? "text-white" : "text-white/90"}"></i>`;

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      options.onToggleSave!(place as DiscoveryPlace);
    });
    imgWrapper.appendChild(saveBtn);
  }

  container.appendChild(imgWrapper);

  // 2. Card Content Body
  const body = document.createElement("div");
  body.className = "p-3 space-y-1.5";

  // Title (clickable to detail)
  const title = document.createElement("h4");
  title.className = "font-bold text-slate-900 text-[13.5px] leading-snug line-clamp-1 cursor-pointer hover:text-[#0194F3] transition-colors";
  title.textContent = place.name;
  if (onOpenDetail) {
    title.addEventListener("click", () => onOpenDetail(place.id));
  }
  body.appendChild(title);

  // Rating, Price, Status Row
  const metaRow = document.createElement("div");
  metaRow.className = "flex items-center gap-1.5 text-xs flex-wrap";

  if (place.rating && place.rating > 0) {
    const ratingEl = document.createElement("span");
    ratingEl.className = "font-extrabold text-amber-500 flex items-center gap-1 text-[11px]";
    ratingEl.innerHTML = `
      <i class="fa-solid fa-star text-[10px] text-amber-500" aria-hidden="true"></i>
      <span>${place.rating.toFixed(1)}</span>
    `;
    metaRow.appendChild(ratingEl);

    if (place.reviewCount) {
      const reviewEl = document.createElement("span");
      reviewEl.className = "text-slate-400 text-[10.5px]";
      reviewEl.textContent = `(${place.reviewCount})`;
      metaRow.appendChild(reviewEl);
    }
    metaRow.appendChild(document.createTextNode("•"));
  }

  const isOpen =
    "isOpenNow" in place
      ? place.isOpenNow
      : "openingHoursText" in place && typeof place.openingHoursText === "string"
        ? place.openingHoursText === "Đang mở cửa"
        : null;

  if (isOpen !== null && isOpen !== undefined) {
    const statusEl = document.createElement("span");
    statusEl.className = isOpen
      ? "text-emerald-600 font-semibold text-[10.5px]"
      : "text-slate-400 font-medium text-[10.5px]";
    statusEl.textContent = isOpen ? "Đang mở cửa" : "Đã đóng cửa";
    metaRow.appendChild(statusEl);
  }

  body.appendChild(metaRow);

  // Address Row with distance
  const addressRow = document.createElement("div");
  addressRow.className = "flex items-center gap-1.5 text-xs text-slate-500";

  const addressText = document.createElement("p");
  addressText.className = "line-clamp-1 flex-1 text-[11px]";
  addressText.textContent = place.address || "Việt Nam";
  addressRow.appendChild(addressText);

  if (distanceKm !== undefined && distanceKm !== null) {
    const distBadge = document.createElement("span");
    distBadge.className = "px-1.5 py-0.2 rounded bg-[#0194F3]/10 text-[#0194F3] font-bold text-[10px] whitespace-nowrap";
    distBadge.textContent = routingService.formatDistanceKm(distanceKm);
    addressRow.appendChild(distBadge);
  }

  body.appendChild(addressRow);

  // 3. Action Buttons Row
  const actionsRow = document.createElement("div");
  actionsRow.className = "pt-2 border-t border-slate-100 space-y-1.5";

  if (options?.isRoutingActive) {
    const isAlreadyInRoute =
      typeof options.routeStopIndex === "number" && options.routeStopIndex >= 0;

    if (isAlreadyInRoute) {
      const stopIdx = options.routeStopIndex!;
      const stopLetter = String.fromCharCode(65 + stopIdx);

      const row1 = document.createElement("div");
      row1.className = "flex items-center gap-1.5";

      const statusBadge = document.createElement("div");
      statusBadge.className =
        "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0194F3]/10 border border-[#0194F3]/25 py-1.5 px-2 text-[11px] font-bold text-[#0194F3]";
      statusBadge.innerHTML = `
        <i class="fa-solid fa-check text-xs shrink-0" aria-hidden="true"></i>
        <span class="truncate">Đang là Chặng ${stopLetter} (#${stopIdx + 1})</span>
      `;
      row1.appendChild(statusBadge);

      if (options.onRemoveStopFromRoute) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className =
          "shrink-0 inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 py-1.5 px-2.5 text-[11px] font-bold text-rose-600 transition-colors cursor-pointer active:scale-95";
        removeBtn.innerHTML = `
          <i class="fa-solid fa-trash-can text-xs shrink-0" aria-hidden="true"></i>
          <span>Gỡ chặng</span>
        `;
        removeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onRemoveStopFromRoute!(place.id);
        });
        row1.appendChild(removeBtn);
      }

      actionsRow.appendChild(row1);

      const row2 = document.createElement("div");
      row2.className = "flex items-center gap-1.5";

      if (stopIdx > 0 && options.onSetOrigin) {
        const originBtn = document.createElement("button");
        originBtn.type = "button";
        originBtn.className =
          "flex-1 min-w-0 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 px-2 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer";
        originBtn.innerHTML = `
          <i class="fa-solid fa-flag-checkered text-xs shrink-0" aria-hidden="true"></i>
          <span>Điểm xuất phát</span>
        `;
        originBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onSetOrigin!(place as DiscoveryPlace);
        });
        row2.appendChild(originBtn);
      }

      const detailLink = document.createElement("a");
      detailLink.href = `/places/${place.slug || place.id}`;
      detailLink.className =
        stopIdx > 0 && options.onSetOrigin
          ? "shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[11px] font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap no-underline"
          : "w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[11px] font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap no-underline";
      detailLink.textContent = "Xem chi tiết";
      if (onOpenDetail) {
        detailLink.addEventListener("click", (e) => {
          e.preventDefault();
          onOpenDetail(place.id);
        });
      }
      row2.appendChild(detailLink);
      actionsRow.appendChild(row2);
    } else {
      // Place is NOT yet in the active route: Row 1 has Add Stop & Set Origin; Row 2 has View Detail
      const row1 = document.createElement("div");
      row1.className = "flex items-center gap-1.5";

      if (options.onAddStopToRoute) {
        const addStopBtn = document.createElement("button");
        addStopBtn.type = "button";
        addStopBtn.className =
          "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0194F3] hover:bg-[#0082d6] py-1.5 px-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer active:scale-95";
        addStopBtn.innerHTML = `
          <i class="fa-solid fa-plus text-xs shrink-0" aria-hidden="true"></i>
          <span>Thêm chặng</span>
        `;
        addStopBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onAddStopToRoute!(place as DiscoveryPlace);
        });
        row1.appendChild(addStopBtn);
      }

      if (options.onSetOrigin) {
        const originBtn = document.createElement("button");
        originBtn.type = "button";
        originBtn.className =
          "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 px-2 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer active:scale-95";
        originBtn.innerHTML = `
          <i class="fa-solid fa-flag-checkered text-xs shrink-0" aria-hidden="true"></i>
          <span>Điểm xuất phát</span>
        `;
        originBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onSetOrigin!(place as DiscoveryPlace);
        });
        row1.appendChild(originBtn);
      }

      actionsRow.appendChild(row1);

      const row2 = document.createElement("div");
      row2.className = "flex items-center gap-1.5";

      if (options.onAddToItinerary) {
        const addItineraryBtn = document.createElement("button");
        addItineraryBtn.type = "button";
        addItineraryBtn.className =
          "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0194F3]/35 bg-[#0194F3]/10 hover:bg-[#0194F3]/20 py-1.5 px-2 text-[11px] font-bold text-[#0194F3] transition-colors cursor-pointer active:scale-95";
        addItineraryBtn.innerHTML = `
          <i class="fa-solid fa-calendar-plus text-xs shrink-0" aria-hidden="true"></i>
          <span class="truncate">Thêm lịch trình</span>
        `;
        addItineraryBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onAddToItinerary!(place as DiscoveryPlace);
        });
        row2.appendChild(addItineraryBtn);
      }

      const detailLink = document.createElement("a");
      detailLink.href = `/places/${place.slug || place.id}`;
      detailLink.className = options.onAddToItinerary
        ? "shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[11px] font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap no-underline"
        : "w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[11px] font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap no-underline";
      detailLink.textContent = "Xem chi tiết";
      if (onOpenDetail) {
        detailLink.addEventListener("click", (e) => {
          e.preventDefault();
          onOpenDetail(place.id);
        });
      }
      row2.appendChild(detailLink);
      actionsRow.appendChild(row2);
    }
  } else {
    // When routing is NOT active:
    const row1 = document.createElement("div");
    row1.className = "flex items-center gap-2";

    if (onRequestDirections) {
      const dirBtn = document.createElement("button");
      dirBtn.type = "button";
      dirBtn.className = "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0194F3] hover:bg-[#0082d6] py-2 px-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer active:scale-95";
      dirBtn.innerHTML = `
        <i class="fa-solid fa-route text-xs"></i>
        <span>Chỉ đường</span>
      `;
      dirBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onRequestDirections(place as DiscoveryPlace);
      });
      row1.appendChild(dirBtn);
    }

    const detailLink = document.createElement("a");
    detailLink.href = `/places/${place.slug || place.id}`;
    detailLink.className = onRequestDirections
      ? "shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2 px-3 text-xs font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap shadow-2xs no-underline"
      : "w-full inline-flex items-center justify-center rounded-xl bg-[#0194F3] hover:bg-[#0082d6] py-2 px-3 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs no-underline";
    detailLink.textContent = onRequestDirections ? "Chi tiết" : "Xem chi tiết";
    if (onOpenDetail) {
      detailLink.addEventListener("click", (e) => {
        e.preventDefault();
        onOpenDetail(place.id);
      });
    }
    row1.appendChild(detailLink);
    actionsRow.appendChild(row1);

    // Row 2: Add to Itinerary & Set Origin buttons
    if (options?.onAddToItinerary || options?.onSetOrigin) {
      const row2 = document.createElement("div");
      row2.className = "flex items-center gap-1.5 pt-0.5";

      if (options.onAddToItinerary) {
        const addItineraryBtn = document.createElement("button");
        addItineraryBtn.type = "button";
        addItineraryBtn.className =
          "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0194F3]/35 bg-[#0194F3]/10 hover:bg-[#0194F3]/20 py-1.5 px-2 text-[11px] font-bold text-[#0194F3] transition-colors cursor-pointer active:scale-95";
        addItineraryBtn.innerHTML = `
          <i class="fa-solid fa-calendar-plus text-xs shrink-0" aria-hidden="true"></i>
          <span class="truncate">${options.onSetOrigin ? "Thêm lịch trình" : "Thêm vào lịch trình"}</span>
        `;
        addItineraryBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onAddToItinerary!(place as DiscoveryPlace);
        });
        row2.appendChild(addItineraryBtn);
      }

      if (options.onSetOrigin) {
        const originBtn = document.createElement("button");
        originBtn.type = "button";
        originBtn.className =
          "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 px-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer active:scale-95";
        originBtn.innerHTML = `
          <i class="fa-solid fa-flag-checkered text-xs shrink-0" aria-hidden="true"></i>
          <span class="truncate">${options.onAddToItinerary ? "Điểm xuất phát" : "Đặt làm điểm xuất phát"}</span>
        `;
        originBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          options.onSetOrigin!(place as DiscoveryPlace);
        });
        row2.appendChild(originBtn);
      }

      actionsRow.appendChild(row2);
    }
  }

  body.appendChild(actionsRow);
  container.appendChild(body);

  return container;
}
