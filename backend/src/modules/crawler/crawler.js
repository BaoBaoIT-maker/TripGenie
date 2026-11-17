/**
 * Bộ điều phối cào dữ liệu Google Maps ĐA TỈNH THÀNH với cơ chế KIỂM TRA CHẤT LƯỢNG & CÀO BÙ TỰ ĐỘNG
 * Hỗ trợ quy mô 1.000+ địa điểm, dọn dẹp RAM tự động và cuộn feed động
 * Đường dẫn: backend/src/modules/crawler/crawler.js
 */
const { chromium } = require('playwright');
const { getBravePath, getProvinceConfig, getTopicsForProvince, generateBroadQueries } = require('./config');
const { normalizeSlug, mapCategory, getPriceInfo } = require('./category-mapper');
const { generateEditorialContent } = require('./editorial-generator');
const { extractPlaceDetails, extractCoordinates } = require('./extractor');
const { savePlaces } = require('./storage');

async function createOptimizedPage(context) {
  const page = await context.newPage();

  // TỐI ƯU HIỆU NĂNG: Chặn tracking, telemetry, fonts, media phụ
  // Giúp Google Maps tải nhanh gấp 2 - 3 lần, tiết kiệm RAM
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const type = route.request().resourceType();

    if (
      url.includes('google-analytics.com') ||
      url.includes('googletagmanager.com') ||
      url.includes('play.google.com/log') ||
      url.includes('stats.g.doubleclick.net') ||
      type === 'font' ||
      type === 'media'
    ) {
      return route.abort();
    }
    return route.continue();
  });

  return page;
}

async function scrapePlacesForQuery(page, query, topicKey, maxPlacesForQuery, globalState) {
  if (globalState.currentCount >= globalState.targetTotal) return [];

  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/${globalState.province.coords}`;
  console.log(`\n🔍 Đang tìm kiếm: "${query}"...`);

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    // Chờ kết quả xuất hiện linh hoạt thay vì ngủ cứng
    await page.waitForSelector('a[href*="/maps/place/"], div[role="feed"]', { timeout: 6000 }).catch(() => null);

    // CUỘN DANH SÁCH THẬT BẰNG MOUSE WHEEL (Kích hoạt lazy loading của Google Maps)
    const scrollTimes = globalState.scrollTimes || 3;
    const feed = await page.$('div[role="feed"], div[aria-label*="Kết quả"]');
    if (feed) {
      const box = await feed.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < scrollTimes; i++) {
          await page.mouse.wheel(0, 3500);
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (err) {
    console.warn(`  ⚠️ Timeout khi tải trang tìm kiếm: ${err.message}`);
    return [];
  }

  // Lấy toàn bộ danh sách liên kết địa điểm xuất hiện trong feed
  const placeLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
    const unique = [];
    const seen = new Set();
    for (const a of anchors) {
      const name = a.getAttribute('aria-label') || '';
      if (name && !seen.has(name)) {
        seen.add(name);
        unique.push({ name, href: a.href });
      }
    }
    return unique;
  });

  const available = placeLinks.filter(p => !globalState.seenNames.has(p.name.toLowerCase().trim()));
  console.log(`  📋 Tìm thấy ${placeLinks.length} kết quả (${available.length} quán mới). Cần lấy tối đa ${maxPlacesForQuery} quán đạt chuẩn.`);

  const results = [];
  let candidateIndex = 0;

  // VÒNG LẶP CÀO BÙ: Lấy cho đến khi đủ số lượng đạt chuẩn hoặc hết ứng viên
  while (results.length < maxPlacesForQuery && candidateIndex < available.length) {
    if (globalState.currentCount >= globalState.targetTotal) break;

    const item = available[candidateIndex];
    candidateIndex++;

    console.log(`  ➡️ [${results.length + 1}/${maxPlacesForQuery}] Đang kiểm tra: "${item.name}"...`);

    try {
      await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Chờ h1 hoặc tiêu đề địa điểm hiển thị
      let h1Found = await page.waitForSelector('h1.fontHeadlineLarge, h1', { timeout: 6000 }).catch(() => null);

      let currentUrl = page.url();
      // Chỉ kích hoạt fallback khi link thật sự bị redirect sang bản đồ rỗng
      const isBlankMap = currentUrl.includes('/place//@') || (!currentUrl.includes('/maps/place/') && !h1Found);

      if (isBlankMap) {
        console.log(`     ⚠️ Link bị chuyển hướng bản đồ trống. Thử tìm kiếm trực tiếp bằng tên quán...`);
        const fallbackSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(item.name + ' ' + globalState.province.city)}`;
        await page.goto(fallbackSearchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);

        // Nếu Google Maps hiển thị danh sách kết quả, click vào kết quả đầu tiên để mở chi tiết địa điểm
        if (!page.url().includes('/maps/place/')) {
          const firstCard = await page.$('a[href*="/maps/place/"]');
          if (firstCard) {
            await firstCard.click();
            h1Found = await page.waitForSelector('h1.fontHeadlineLarge, h1', { timeout: 5000 }).catch(() => null);
          }
        }
      }

      // Đợi ảnh thực tế gắn vào DOM (chờ tối đa 3.5s, ảnh tải xong lúc nào là chạy tiếp ngay)
      await page.waitForSelector('img[src*="googleusercontent.com"]', { timeout: 3500 }).catch(() => null);

      // Bóc tách DOM
      const details = await extractPlaceDetails(page);
      const coords = extractCoordinates(page.url());

      // =========================================================================
      // 🛡️ CƠ CHẾ KIỂM TRA CHẤT LƯỢNG (QUALITY GATE)
      // =========================================================================
      const hasRealPhoto = details.photos && details.photos.length > 0;
      const hasValidName = (details.name || item.name).trim().length > 1;

      // LỌC CHẤT LƯỢNG CAO: Loại bỏ nhà riêng, quán ảo 0 review hoặc ảnh tự sướng cá nhân
      const isReputablePlace = (details.reviewCount && details.reviewCount >= 2) || (details.ratingAvg && details.ratingAvg >= 3.0);

      if (!hasRealPhoto || !hasValidName || !isReputablePlace) {
        const reason = !hasRealPhoto ? 'Chưa nạp kịp ảnh HD' : (!isReputablePlace ? '0 review/quán ảo' : 'Tên không hợp lệ');
        console.log(`     ❌ [BỎ QUA & CÀO BÙ] "${item.name}" không đạt chuẩn (${reason}). Đang cào bù quán uy tín khác...`);
        continue; // Bỏ qua quán này, vòng lặp while sẽ tự động lấy ứng viên tiếp theo để bù vào!
      }

      // ĐẠT CHUẨN: Chuẩn hóa đối tượng
      globalState.seenNames.add(item.name.toLowerCase().trim());
      globalState.currentCount++;

      const placeName = details.name || item.name;
      const catInfo = mapCategory(details.categoryName, topicKey, placeName);
      const slug = normalizeSlug(placeName);
      const priceInfo = getPriceInfo(catInfo.categorySlug, details.rawPriceText);
      const editorial = generateEditorialContent(placeName, catInfo.categorySlug, details.ratingAvg);

      const placeObj = {
        id: `${globalState.province.key.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        slug: slug,
        name: placeName,
        nameNormalized: slug.replace(/-/g, ' '),
        tagline: editorial.tagline,

        categoryId: catInfo.categoryId,
        categorySlug: catInfo.categorySlug,
        categoryName: catInfo.categoryName,
        category: catInfo.frontendCat,
        categoryLabel: catInfo.categoryName,
        areaId: globalState.province.areaId,
        areaSlug: globalState.province.slug,
        areaName: globalState.province.areaName,
        city: globalState.province.city,

        address: details.address || `${globalState.province.name}, Việt Nam`,
        latitude: coords.lat,
        longitude: coords.lng,
        phone: details.phone,
        website: details.website,
        googleMapsUrl: page.url(),

        rating: details.ratingAvg || 0,
        ratingAvg: details.ratingAvg || 0,
        reviewCount: details.reviewCount || 0,

        priceLevel: priceInfo.priceLevel,
        priceRangeText: priceInfo.priceRangeText,
        openingHoursText: details.openingHoursText,
        openingHours: {
          rawText: details.openingHoursText,
          open: '07:00',
          close: '22:30',
        },

        description: `Địa điểm nổi bật tại ${globalState.province.areaName} thuộc danh mục ${catInfo.categoryName}. Sở hữu điểm đánh giá ${details.ratingAvg ? details.ratingAvg + '⭐' : 'mới'} trên Google Maps với ${details.reviewCount || 0} lượt đánh giá từ du khách.`,
        whyGo: editorial.whyGo,
        tips: editorial.tips,
        suggestedDuration: editorial.suggestedDuration,
        suitableFor: editorial.suitableFor,
        styles: editorial.styles,

        coverImage: details.photos[0],
        photos: details.photos,
        images: details.photos,
        imageCount: details.photos.length,

        tags: [catInfo.categoryName, globalState.province.name, catInfo.frontendCat],
        topic: topicKey,
        approved: true,
      };

      console.log(`     ✅ [ĐẠT CHUẨN ${globalState.currentCount}/${globalState.targetTotal}] ${placeObj.name} | ${details.ratingAvg ? details.ratingAvg + '⭐' : 'Mới'} (${details.reviewCount} reviews) | ${details.photos.length} ảnh HD`);
      results.push(placeObj);
    } catch (err) {
      console.warn(`     ⚠️ Lỗi khi bóc tách ${item.name}: ${err.message}. Đang cào bù quán khác...`);
    }
  }

  return results;
}

async function startCrawler(options = {}) {
  const bravePath = getBravePath();
  if (!bravePath) {
    console.error('❌ Không tìm thấy trình duyệt Brave trên máy của bạn!');
    process.exit(1);
  }

  let targetProvince = options.province;
  // Tự động nhận diện tỉnh/thành từ từ khóa tùy chọn nếu người dùng không gõ --province
  if ((!targetProvince || targetProvince === 'DANANG') && options.query) {
    const q = options.query.toLowerCase();
    if (q.includes('sài gòn') || q.includes('hcm') || q.includes('hồ chí minh') || q.includes('quận 1') || q.includes('quận 3') || q.includes('quận 7') || q.includes('thủ đức')) {
      targetProvince = 'HCMC';
    } else if (q.includes('đà lạt') || q.includes('lâm đồng') || q.includes('bảo lộc')) {
      targetProvince = 'LAMDONG';
    } else if (q.includes('an giang') || q.includes('long xuyên') || q.includes('châu đốc') || q.includes('tri tôn')) {
      targetProvince = 'ANGIANG';
    } else if (q.includes('đà nẵng') || q.includes('hải châu') || q.includes('sơn trà')) {
      targetProvince = 'DANANG';
    }
  }

  const provinceConfig = getProvinceConfig(targetProvince || 'DANANG');
  const topicsConfig = getTopicsForProvince(provinceConfig);

  const targetTotal = options.targetTotal || 200;
  const isHeadless = Boolean(options.headless);
  const isAppendMode = Boolean(options.append);
  const topicFilter = options.topic || 'ALL';

  let selectedTopics = [];
  const upperTopic = (topicFilter || 'ALL').toUpperCase();
  if (upperTopic === 'STAY' || upperTopic === 'HOTEL') selectedTopics = [topicsConfig.STAY];
  else if (upperTopic === 'FOOD') selectedTopics = [topicsConfig.FOOD];
  else if (upperTopic === 'CAFE') selectedTopics = [topicsConfig.CAFE];
  else if (upperTopic === 'SIGHTSEEING' || upperTopic === 'TOURISM') selectedTopics = [topicsConfig.SIGHTSEEING];
  else if (upperTopic === 'NIGHTLIFE') selectedTopics = [topicsConfig.NIGHTLIFE];
  else if (upperTopic === 'SHOPPING') selectedTopics = [topicsConfig.SHOPPING];
  else selectedTopics = Object.values(topicsConfig);

  // Tính số lần cuộn feed theo quy mô mục tiêu (Cuộn chuột sâu để Google nạp hàng trăm quán)
  const scrollTimes = targetTotal <= 200 ? 3 : (targetTotal <= 500 ? 5 : 8);

  console.log('================================================================');
  console.log(`🦁 TRÌNH CÀO GOOGLE MAPS TRIPGENIE (MODULAR) - MỤC TIÊU: ${targetTotal} ĐỊA ĐIỂM`);
  console.log('================================================================');
  console.log(`• Khu vực cào       : ${provinceConfig.areaName} (ID: ${provinceConfig.areaId})`);
  console.log(`• Tọa độ trung tâm  : ${provinceConfig.coords}`);
  console.log(`• Số lượng mục tiêu : ${targetTotal} địa điểm ĐẠT CHUẨN (Cào bù tự động)`);
  console.log(`• Độ sâu cuộn feed  : ${scrollTimes} lần/truy vấn (Đảm bảo đủ dữ liệu quy mô lớn)`);
  console.log(`• Chế độ hiển thị   : ${isHeadless ? 'Headless (Chạy ngầm)' : 'Bật cửa sổ Brave'}`);
  console.log(`• Chế độ lưu trữ    : ${isAppendMode ? 'Gộp thêm vào file cũ (--append)' : 'Làm sạch mới 100% (Clean Batch)'}`);
  console.log(`• Phân bổ 6 danh mục đồng bộ với Giao diện người dùng:`);
  selectedTopics.forEach((t) => {
    const quota = selectedTopics.length === 1 ? targetTotal : Math.round(targetTotal * t.targetRatio);
    console.log(`   - ${t.name.padEnd(28)} : ~${quota} địa điểm (${Math.round(t.targetRatio * 100)}%)`);
  });
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: bravePath,
    headless: isHeadless,
  });

  const context = await browser.newContext({
    locale: 'vi-VN',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  let page = await createOptimizedPage(context);
  const allScraped = [];

  const globalState = {
    currentCount: 0,
    targetTotal: targetTotal,
    seenNames: new Set(),
    province: provinceConfig,
    scrollTimes: scrollTimes,
  };

  // CHẾ ĐỘ CÀO ĐẶC BIỆT: TÌM TRỰC TIẾP TỪ KHÓA TÙY CHỌN (--query "Highlands Coffee Đà Nẵng" / "Jollibee Đà Nẵng")
  if (options.query) {
    const customQuery = options.query;
    let customTopic = options.topic && options.topic !== 'ALL' ? options.topic : 'FOOD';
    const qLower = customQuery.toLowerCase();
    if (qLower.includes('cafe') || qLower.includes('coffee') || qLower.includes('cà phê') || qLower.includes('trà') || qLower.includes('starbuck') || qLower.includes('highland') || qLower.includes('phúc long')) {
      customTopic = 'CAFE';
    } else if (qLower.includes('khách sạn') || qLower.includes('hotel') || qLower.includes('homestay') || qLower.includes('resort')) {
      customTopic = 'STAY';
    } else if (qLower.includes('bar') || qLower.includes('pub') || qLower.includes('club')) {
      customTopic = 'NIGHTLIFE';
    } else if (qLower.includes('chợ') || qLower.includes('siêu thị') || qLower.includes('mua sắm')) {
      customTopic = 'SHOPPING';
    } else if (qLower.includes('du lịch') || qLower.includes('tham quan') || qLower.includes('chùa')) {
      customTopic = 'SIGHTSEEING';
    }

    console.log(`\n🎯 CHẾ ĐỘ CÀO THEO TỪ KHÓA CHỈ ĐỊNH: "${customQuery}"`);
    console.log(`• Chủ đề gán tự động : ${customTopic}`);
    console.log(`• Chỉ tiêu thu thập   : ${targetTotal} địa điểm`);
    console.log(`• Chế độ gộp          : ${isAppendMode ? 'Gộp thêm vào danh sách cũ (--append)' : 'Làm mới'}`);

    const places = await scrapePlacesForQuery(page, customQuery, customTopic, targetTotal, globalState);
    allScraped.push(...places);
  } else {
    for (const topic of selectedTopics) {
      if (globalState.currentCount >= globalState.targetTotal) break;

      // Tự động dọn dẹp RAM (Memory Recycling) trước mỗi chủ đề mới
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
      page = await createOptimizedPage(context);

      const topicTarget = selectedTopics.length === 1
        ? targetTotal
        : Math.max(3, Math.round(targetTotal * (topic.targetRatio || (1 / selectedTopics.length))));
      let topicCount = 0;
      const maxPlacesPerQuery = Math.max(25, Math.ceil(topicTarget / Math.max(1, topic.queries.length)) + 5);

      console.log(`\n################################################################`);
      console.log(`BẮT ĐẦU CHỦ ĐỀ: ${topic.name} (Chỉ tiêu: ~${topicTarget} địa điểm)`);
      console.log(`################################################################`);

      for (const query of topic.queries) {
        if (globalState.currentCount >= globalState.targetTotal) break;
        if (topicCount >= topicTarget && selectedTopics.length > 1) break;

        if (!page || page.isClosed()) {
          page = await createOptimizedPage(context);
        }

        const maxForQuery = Math.min(maxPlacesPerQuery, topicTarget - topicCount);
        const places = await scrapePlacesForQuery(page, query, topic.key, maxForQuery, globalState);
        topicCount += places.length;
        allScraped.push(...places);
      }

      // 2. CƠ CHẾ VÉT DIỆN RỘNG (BROAD QUERY BACKFILL)
      // Nếu chạy hết từ khóa chính mà vẫn chưa đủ chỉ tiêu, tự động kích hoạt các từ khóa ngắn diện rộng theo quận (cafe quận 1, trà sữa quận 2, quán ăn...)
      if (topicCount < topicTarget && globalState.currentCount < globalState.targetTotal) {
        const broadQueries = generateBroadQueries(topic.key, provinceConfig);
        console.log(`\n  ⚡ [KÍCH HOẠT VÉT DIỆN RỘNG] Chủ đề ${topic.name} mới đạt ${topicCount}/${topicTarget}. Tự động tìm kiếm diện rộng theo quận...`);

        for (const bQuery of broadQueries) {
          if (globalState.currentCount >= globalState.targetTotal) break;
          if (topicCount >= topicTarget && selectedTopics.length > 1) break;

          if (!page || page.isClosed()) {
            page = await createOptimizedPage(context);
          }

          const maxForQuery = Math.min(maxPlacesPerQuery, topicTarget - topicCount);
          const places = await scrapePlacesForQuery(page, bQuery, topic.key, maxForQuery, globalState);
          topicCount += places.length;
          allScraped.push(...places);
        }
      }
    }
  }

  await browser.close();

  // Lưu file dữ liệu
  const saveResult = savePlaces(allScraped, isAppendMode);

  console.log('\n================================================================');
  console.log(`🎉 HOÀN THÀNH CÀO GOOGLE MAPS (${provinceConfig.areaName})!`);
  console.log(`📦 Tổng cộng thu thập được: ${saveResult.count} địa điểm 100% ĐẠT CHUẨN (Đã cào bù sạch ảnh lỗi).`);
  console.log(`📁 File lưu trữ:`);
  console.log(`   - ${saveResult.jsonFile}`);
  console.log(`   - ${saveResult.jsFile}`);
  console.log(`\n👉 HÃY CHẠY: node backend/src/modules/crawler/serve-preview.js ĐỂ MỞ BRAVE XEM DỮ LIỆU ĐÃ LỌC!`);
  console.log('================================================================\n');
}

module.exports = {
  startCrawler,
};
