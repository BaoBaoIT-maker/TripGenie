import type { DiscoveryPlace, NearbyPlace } from "@/features/map/types";
import { routingService } from "@/services/routing.service";

export function createMapPopupElement(
  item: NearbyPlace | DiscoveryPlace,
  onOpenDetail?: (placeId: string) => void,
  onRequestDirections?: (place: DiscoveryPlace) => void,
  options?: {
    isRoutingActive?: boolean;
    isSaved?: boolean;
    onToggleSave?: (place: DiscoveryPlace) => void;
    onAddStopToRoute?: (place: DiscoveryPlace) => void;
    onSetOrigin?: (place: DiscoveryPlace) => void;
  }
): HTMLDivElement {
  const place = "place" in item ? item.place : item;
  const distanceKm = "distanceKm" in item ? item.distanceKm : undefined;

  const container = document.createElement("div");
  container.className = "w-[290px] overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl font-sans select-none";

  // 1. Header Image or Neutral Placeholder
  // Prioritize authentic photo from database
  const dbImage =
    ("coverImage" in place && typeof place.coverImage === "string" && place.coverImage.trim() ? place.coverImage.trim() : null) ||
    ("primaryImage" in place && typeof place.primaryImage === "string" && place.primaryImage.trim() ? place.primaryImage.trim() : null) ||
    (Array.isArray(place.images) && place.images.length > 0 && typeof place.images[0] === "string" && place.images[0].trim() ? place.images[0].trim() : null);

  const imgWrapper = document.createElement("div");
  imgWrapper.className = "relative w-full h-32 bg-muted overflow-hidden group cursor-pointer";
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
        <div class="w-full h-full bg-muted/60 flex flex-col items-center justify-center p-3 text-center">
          <div class="size-8 rounded-full bg-background/80 shadow-xs flex items-center justify-center text-muted-foreground/80 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </div>
          <span class="text-xs font-semibold text-foreground/85">Chưa có ảnh thực tế</span>
          <span class="text-[10px] text-muted-foreground">${place.categoryLabel || place.category}</span>
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
    placeholder.className = "w-full h-full bg-gradient-to-br from-muted/80 to-muted/40 flex flex-col items-center justify-center p-3 text-center";
    placeholder.innerHTML = `
      <div class="size-9 rounded-full bg-background/90 shadow-xs flex items-center justify-center text-muted-foreground mb-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
      </div>
      <span class="text-xs font-semibold text-foreground/80">Chưa có ảnh thực tế</span>
      <span class="text-[10.5px] text-muted-foreground font-medium">${place.categoryLabel || place.category}</span>
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
    saveBtn.innerHTML = options.isSaved
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

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
  title.className = "font-bold text-foreground text-[13.5px] leading-snug line-clamp-1 cursor-pointer hover:text-primary transition-colors";
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
    ratingEl.className = "font-extrabold text-amber-500 flex items-center gap-0.5 text-[11px]";
    ratingEl.innerHTML = `<span>★</span><span>${place.rating.toFixed(1)}</span>`;
    metaRow.appendChild(ratingEl);

    if (place.reviewCount) {
      const reviewEl = document.createElement("span");
      reviewEl.className = "text-muted-foreground text-[10.5px]";
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
      ? "text-emerald-600 dark:text-emerald-400 font-semibold text-[10.5px]"
      : "text-muted-foreground font-medium text-[10.5px]";
    statusEl.textContent = isOpen ? "Đang mở cửa" : "Đã đóng cửa";
    metaRow.appendChild(statusEl);
  }

  body.appendChild(metaRow);

  // Address Row with distance
  const addressRow = document.createElement("div");
  addressRow.className = "flex items-center gap-1.5 text-xs text-muted-foreground";

  const addressText = document.createElement("p");
  addressText.className = "line-clamp-1 flex-1 text-[11px]";
  addressText.textContent = place.address || "Việt Nam";
  addressRow.appendChild(addressText);

  if (distanceKm !== undefined && distanceKm !== null) {
    const distBadge = document.createElement("span");
    distBadge.className = "px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold text-[10px] whitespace-nowrap";
    distBadge.textContent = routingService.formatDistanceKm(distanceKm);
    addressRow.appendChild(distBadge);
  }

  body.appendChild(addressRow);

  // 3. Action Buttons Row (2 spacious rows so 'Chi tiết →' is NEVER cut off)
  const actionsRow = document.createElement("div");
  actionsRow.className = "pt-2 border-t border-border/60 space-y-1.5";

  if (options?.isRoutingActive) {
    // When routing is active: Row 1 has Add Stop & Set Destination; Row 2 has Set Start & View Detail
    const row1 = document.createElement("div");
    row1.className = "flex items-center gap-1.5";

    if (options.onAddStopToRoute) {
      const addStopBtn = document.createElement("button");
      addStopBtn.type = "button";
      addStopBtn.className = "flex-1 min-w-0 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-1.5 px-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer active:scale-95";
      addStopBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Thêm chặng</span>
      `;
      addStopBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        options.onAddStopToRoute!(place as DiscoveryPlace);
      });
      row1.appendChild(addStopBtn);
    }

    if (onRequestDirections) {
      const setDestBtn = document.createElement("button");
      setDestBtn.type = "button";
      setDestBtn.className = "flex-1 min-w-0 inline-flex items-center justify-center gap-1 rounded-xl bg-primary hover:bg-primary/90 py-1.5 px-2 text-xs font-bold text-primary-foreground shadow-xs transition-colors cursor-pointer active:scale-95";
      setDestBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        <span>Đích mới</span>
      `;
      setDestBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onRequestDirections(place as DiscoveryPlace);
      });
      row1.appendChild(setDestBtn);
    }
    actionsRow.appendChild(row1);

    const row2 = document.createElement("div");
    row2.className = "flex items-center gap-1.5";

    if (options.onSetOrigin) {
      const originBtn = document.createElement("button");
      originBtn.type = "button";
      originBtn.className = "flex-1 min-w-0 inline-flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-muted/50 hover:bg-muted py-1.5 px-2 text-[11px] font-semibold text-foreground transition-colors cursor-pointer";
      originBtn.innerHTML = `<span>🚩</span><span>Điểm xuất phát</span>`;
      originBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        options.onSetOrigin!(place as DiscoveryPlace);
      });
      row2.appendChild(originBtn);
    }

    const detailLink = document.createElement("a");
    detailLink.href = `/places/${place.slug || place.id}`;
    detailLink.className = "shrink-0 inline-flex items-center justify-center rounded-xl border border-border/80 bg-background hover:bg-muted py-1.5 px-3 text-[11px] font-bold text-foreground transition-colors cursor-pointer whitespace-nowrap no-underline";
    detailLink.textContent = "Chi tiết →";
    if (onOpenDetail) {
      detailLink.addEventListener("click", (e) => {
        e.preventDefault();
        onOpenDetail(place.id);
      });
    }
    row2.appendChild(detailLink);
    actionsRow.appendChild(row2);
  } else {
    // When routing is NOT active:
    // Row 1: [ Chỉ đường (flex-1) ] + [ Chi tiết → (shrink-0) ]
    const row1 = document.createElement("div");
    row1.className = "flex items-center gap-2";

    if (onRequestDirections) {
      const dirBtn = document.createElement("button");
      dirBtn.type = "button";
      dirBtn.className = "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 py-2 px-2.5 text-xs font-bold text-primary-foreground shadow-xs transition-colors cursor-pointer active:scale-95";
      dirBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
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
    detailLink.className = "shrink-0 inline-flex items-center justify-center rounded-xl border border-border/80 bg-background hover:bg-muted py-2 px-3 text-xs font-bold text-foreground transition-colors cursor-pointer whitespace-nowrap shadow-2xs no-underline";
    detailLink.textContent = "Chi tiết →";
    if (onOpenDetail) {
      detailLink.addEventListener("click", (e) => {
        e.preventDefault();
        onOpenDetail(place.id);
      });
    }
    row1.appendChild(detailLink);
    actionsRow.appendChild(row1);

    // Row 2: Full-width Set Origin button
    if (options?.onSetOrigin) {
      const row2 = document.createElement("div");
      row2.className = "flex items-center pt-0.5";

      const originBtn = document.createElement("button");
      originBtn.type = "button";
      originBtn.className = "w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 py-1 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer";
      originBtn.innerHTML = `<span>🚩</span><span>Đặt quán này làm điểm xuất phát</span>`;
      originBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        options.onSetOrigin!(place as DiscoveryPlace);
      });
      row2.appendChild(originBtn);
      actionsRow.appendChild(row2);
    }
  }

  body.appendChild(actionsRow);
  container.appendChild(body);

  return container;
}
