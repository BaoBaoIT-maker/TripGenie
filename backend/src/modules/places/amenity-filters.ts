/**
 * Amenity slug -> SQL predicate (alias `p` = places). Data, not logic: add an amenity by adding a line here.
 * Predicates are static strings (no user input); unknown slugs fall back to a parameterized tag/description match in the repository.
 */
export const AMENITY_FILTERS: Readonly<Record<string, string>> = {
  'ho-boi': `('swimming_pool' = ANY(p.tags) OR p.description ILIKE '%hồ bơi%' OR p.description ILIKE '%bể bơi%')`,
  'gan-bien': `(p.description ILIKE '%biển%' OR p.address ILIKE '%biển%' OR p.address ILIKE '%Võ Nguyên Giáp%' OR p.address ILIKE '%Hoàng Sa%' OR p.address ILIKE '%Trường Sa%')`,
  'an-sang': `('breakfast' = ANY(p.tags) OR p.description ILIKE '%ăn sáng%' OR p.description ILIKE '%bữa sáng%')`,
  'cho-do-xe': `('parking' = ANY(p.tags) OR p.description ILIKE '%đỗ xe%' OR p.description ILIKE '%bãi xe%')`,
  'thu-cung': `('pets' = ANY(p.tags) OR p.description ILIKE '%thú cưng%' OR p.description ILIKE '%chó mèo%')`,
  'may-lanh': `('air_conditioning' = ANY(p.tags) OR p.description ILIKE '%máy lạnh%' OR p.description ILIKE '%điều hòa%')`,
  'wifi': `('wifi' = ANY(p.tags) OR p.description ILIKE '%wifi%')`,
  'o-cam-dien': `(p.description ILIKE '%ổ cắm%' OR p.description ILIKE '%làm việc%')`,
  'view-dep': `(p.description ILIKE '%view%' OR p.description ILIKE '%rooftop%' OR p.description ILIKE '%ngắm cảnh%')`,
  'yen-tinh': `(p.description ILIKE '%yên tĩnh%' OR p.description ILIKE '%làm việc%')`,
  'mo-khuya': `('late_night' = ANY(p.tags) OR p.description ILIKE '%khuya%' OR p.description ILIKE '%24/7%')`,
  'hai-san': `('seafood' = ANY(p.tags) OR p.name ILIKE '%hải sản%' OR p.description ILIKE '%hải sản%')`,
  'dac-san': `('vietnamese' = ANY(p.tags) OR p.description ILIKE '%đặc sản%' OR p.name ILIKE '%mì quảng%' OR p.name ILIKE '%bánh tráng%')`,
  'mon-chay': `('vegetarian' = ANY(p.tags) OR p.description ILIKE '%chay%' OR p.name ILIKE '%chay%')`,
  'ngoai-troi': `('outdoor_seating' = ANY(p.tags) OR p.description ILIKE '%ngoài trời%' OR p.description ILIKE '%thoáng mát%')`,
  'phong-rieng': `(p.description ILIKE '%phòng riêng%' OR p.description ILIKE '%vip%')`,
  'mien-phi': `(p.description ILIKE '%miễn phí%' OR p.price_level = 'LOW')`,
  'check-in': `(p.description ILIKE '%chụp hình%' OR p.description ILIKE '%check-in%' OR p.description ILIKE '%sống ảo%')`,
  'trong-nha': `(p.description ILIKE '%trong nhà%' OR p.description ILIKE '%bảo tàng%')`,
  'tre-em': `(p.description ILIKE '%trẻ em%' OR p.description ILIKE '%gia đình%')`,
  'nhac-song': `('live_music' = ANY(p.tags) OR p.description ILIKE '%nhạc sống%' OR p.description ILIKE '%acoustic%')`,
  'cocktail': `('cocktail' = ANY(p.tags) OR p.description ILIKE '%cocktail%' OR p.description ILIKE '%craft beer%')`,
  'beach-club': `(p.description ILIKE '%beach club%' OR p.description ILIKE '%bãi biển%')`,
  'dac-san-qua': `(p.description ILIKE '%làm quà%' OR p.description ILIKE '%đặc sản%')`,
  'hai-san-kho': `(p.description ILIKE '%hải sản khô%' OR p.description ILIKE '%mực khô%')`,
  'cho-dem': `(p.description ILIKE '%chợ đêm%' OR p.name ILIKE '%chợ đêm%')`,
};

/** Alternate slugs the frontend may send for the same filter. */
export const AMENITY_ALIASES: Readonly<Record<string, string>> = {
  'view-bien': 'gan-bien',
  'pet-friendly': 'thu-cung',
  'wifi-manh': 'wifi',
};
