/**
 * Module lưu trữ & sao lưu dữ liệu cào
 * Đường dẫn: backend/src/modules/crawler/storage.js
 */
const path = require('path');
const fs = require('fs');

function savePlaces(places, isAppendMode = false) {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const jsonFile = path.join(dataDir, 'staged-google-places.json');
  const jsFile = path.join(dataDir, 'staged-google-places.js');

  // Tự động sao lưu đợt cũ vào history
  if (fs.existsSync(jsonFile)) {
    try {
      const historyDir = path.join(dataDir, 'history');
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
      const backupFile = path.join(historyDir, `backup-${Date.now()}.json`);
      fs.copyFileSync(jsonFile, backupFile);
      console.log(`\n💾 Đã tự động sao lưu dữ liệu cũ vào: backend/src/modules/crawler/data/history/${path.basename(backupFile)}`);
    } catch (e) {
      // Bỏ qua nếu lỗi sao lưu
    }
  }

  let combined = places;
  if (isAppendMode && fs.existsSync(jsonFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      const existingNames = new Set(existing.map((e) => e.name.toLowerCase().trim()));
      const freshNew = places.filter((r) => !existingNames.has(r.name.toLowerCase().trim()));
      combined = [...existing, ...freshNew];
      console.log(`➕ Chế độ --append: Đã gộp thêm vào dữ liệu cũ.`);
    } catch (e) {
      combined = places;
    }
  } else {
    console.log(`🧹 Đã làm sạch file. Chỉ lưu đúng ${places.length} địa điểm mới vừa cào.`);
  }

  // Ghi đồng thời ra file JSON và file JS (cho preview)
  fs.writeFileSync(jsonFile, JSON.stringify(combined, null, 2), 'utf-8');
  fs.writeFileSync(
    jsFile,
    `// File dữ liệu tự động đồng bộ từ staged-google-places.json\nwindow.STAGED_GOOGLE_PLACES = ${JSON.stringify(combined, null, 2)};\n`,
    'utf-8'
  );

  return { jsonFile, jsFile, count: combined.length };
}

module.exports = {
  savePlaces,
};
