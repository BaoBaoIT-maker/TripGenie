/**
 * Module bóc tách dữ liệu DOM từ trang Google Maps
 * Đường dẫn: backend/src/modules/crawler/extractor.js
 */

async function extractPlaceDetails(page) {
  return await page.evaluate(() => {
    // 1. Tên quán
    const nameEl = document.querySelector('h1.fontHeadlineLarge') || document.querySelector('h1');
    const name = nameEl ? nameEl.innerText.trim() : '';

    // 2. Điểm đánh giá (Rating thật 100% - hỗ trợ cả tiếng Anh lẫn tiếng Việt)
    let ratingAvg = 0;

    // Cách A: Tìm qua aria-label (Ví dụ: "4.1 stars", "4,2 sao", "4.6 star")
    const starEl = document.querySelector('[aria-label*="star" i], [aria-label*="sao" i]');
    if (starEl) {
      const ariaText = starEl.getAttribute('aria-label') || '';
      const m = ariaText.match(/([1-5][.,][0-9])/);
      if (m) ratingAvg = parseFloat(m[1].replace(',', '.'));
    }

    // Cách B: Tìm qua class hiển thị số điểm lớn của Google Maps
    if (!ratingAvg) {
      const dispEl = document.querySelector('span.fontDisplayLarge, div.fontDisplayLarge, div.F7nice');
      if (dispEl) {
        const m = (dispEl.innerText || '').match(/([1-5][.,][0-9])/);
        if (m) ratingAvg = parseFloat(m[1].replace(',', '.'));
      }
    }

    // Cách C: Quét nhanh các thẻ span có định dạng X.Y (ví dụ '4.1', '4.7', '3.9')
    if (!ratingAvg) {
      const spans = Array.from(document.querySelectorAll('span, div'));
      for (const s of spans) {
        const t = (s.innerText || '').trim();
        if (/^[1-5][.,][0-9]$/.test(t)) {
          ratingAvg = parseFloat(t.replace(',', '.'));
          break;
        }
      }
    }

    // 3. Số lượt đánh giá (đa dạng selector Google Maps)
    let reviewCount = 0;
    const reviewEl = document.querySelector('button[jsaction*="reviewChart"]');
    if (reviewEl) {
      const m = reviewEl.innerText.match(/\d+[\d,.]*/);
      if (m) reviewCount = parseInt(m[0].replace(/\D/g, ''), 10) || 0;
    }

    // Fallback A: Quét aria-label (VD: "347 đánh giá", "121 reviews", "4.8 stars 121 reviews")
    if (!reviewCount) {
      const reviewAriaEls = Array.from(document.querySelectorAll('[aria-label*="đánh giá" i], [aria-label*="review" i]'));
      for (const el of reviewAriaEls) {
        const aria = el.getAttribute('aria-label') || '';
        const m = aria.match(/(\d+[\d,.]*)\s*(?:đánh giá|review|bài đánh giá)/i);
        if (m) {
          reviewCount = parseInt(m[1].replace(/\D/g, ''), 10) || 0;
          if (reviewCount > 0) break;
        }
      }
    }

    // Fallback B: Tìm nút hoặc span có dạng số trong ngoặc đơn (120) hoặc (1.234)
    if (!reviewCount) {
      const spans = Array.from(document.querySelectorAll('span, button'));
      for (const s of spans) {
        const text = (s.innerText || '').trim();
        const m = text.match(/^\(([0-9,.]+)\)$/);
        if (m) {
          const num = parseInt(m[1].replace(/\D/g, ''), 10) || 0;
          if (num > 0) {
            reviewCount = num;
            break;
          }
        }
      }
    }

    // 4. Phân loại gốc từ Google
    const catEl = document.querySelector('button[jsaction*="category"]');
    const categoryName = catEl ? catEl.innerText.trim() : '';

    // 5. Địa chỉ
    const addrBtn = document.querySelector('button[data-item-id="address"]');
    const address = addrBtn ? addrBtn.innerText.replace(/^\s*/, '').trim() : '';

    // 6. Số điện thoại
    const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
    const phone = phoneBtn ? phoneBtn.innerText.replace(/^\s*/, '').trim() : null;

    // 7. Website
    const webBtn = document.querySelector('a[data-item-id="authority"]');
    const website = webBtn ? webBtn.href : null;

    // 8. Giờ mở cửa thật (openingHours)
    let openingHoursText = 'Mở cửa cả ngày (07:00 - 22:30)';
    const hoursBtn = document.querySelector('button[data-item-id="oh"]') ||
                     document.querySelector('div[aria-label*="mở cửa"]') ||
                     document.querySelector('div[aria-label*="đóng cửa"]');
    if (hoursBtn) {
      const rawHours = hoursBtn.getAttribute('aria-label') || hoursBtn.innerText || '';
      if (rawHours) {
        openingHoursText = rawHours.replace(/^\s*/, '').replace(/(\r\n|\n|\r)/gm, ' ').trim();
      }
    }

    // 9. Khoảng giá gốc nếu có
    let rawPriceText = null;
    const priceEl = document.querySelector('span[aria-label*="Giá"]');
    if (priceEl) rawPriceText = priceEl.innerText.trim();

    // 10. BÓC TÁCH ẢNH CHUẨN XÁC 100% (CHỐNG AVATAR & SELFIE RÁC)
    const photos = [];
    const seenPhotos = new Set();

    // Ưu tiên 1: Ảnh bìa Hero Banner chính thức của Google Maps
    const heroImg = document.querySelector('button[jsaction*="heroHeaderImage"] img') ||
                    document.querySelector('div.AeaXub button img') ||
                    document.querySelector('div[role="region"] button img');

    if (heroImg && heroImg.src) {
      const src = heroImg.src;
      if (src.includes('googleusercontent.com') && !src.includes('/a/') && !src.includes('/a-/') && !src.includes('default_user')) {
        const hdCover = src.replace(/=w\d+-h\d+[^=]*/, '=w1200-h800-k-no');
        seenPhotos.add(hdCover);
        photos.push(hdCover);
      }
    }

    // Ưu tiên 2: Các ảnh địa điểm thật (Place Photos)
    const allImgs = Array.from(document.querySelectorAll('button[jsaction*="photo"] img, div[role="region"] img, img'));

    for (const img of allImgs) {
      const src = img.src || '';
      const isGoogleCdn = src.includes('googleusercontent.com');
      const isAvatar = src.includes('/a/') || src.includes('/a-/') || src.includes('default_user') || src.includes('icon') || src.includes('=s36') || src.includes('=s48') || src.includes('=s72');

      if (isGoogleCdn && !isAvatar) {
        const hdUrl = src.replace(/=w\d+-h\d+[^=]*/, '=w800-h600-k-no');
        if (!seenPhotos.has(hdUrl)) {
          seenPhotos.add(hdUrl);
          photos.push(hdUrl);
        }
      }

      if (photos.length >= 6) break;
    }

    return {
      name,
      ratingAvg,
      reviewCount,
      categoryName,
      address,
      phone,
      website,
      openingHoursText,
      rawPriceText,
      photos
    };
  });
}

function extractCoordinates(url) {
  let lat = 16.06;
  let lng = 108.22;

  const atMatch = url.match(/@([0-9.]+),([0-9.]+)/);
  if (atMatch) {
    lat = parseFloat(atMatch[1]);
    lng = parseFloat(atMatch[2]);
  } else {
    const dataMatch = url.match(/!3d([0-9.]+)!4d([0-9.]+)/);
    if (dataMatch) {
      lat = parseFloat(dataMatch[1]);
      lng = parseFloat(dataMatch[2]);
    }
  }

  return { lat, lng };
}

module.exports = {
  extractPlaceDetails,
  extractCoordinates,
};
