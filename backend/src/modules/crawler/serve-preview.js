/**
 * Micro Server để mở trang Preview dữ liệu cào Google Maps trên Brave Browser
 * Chạy lệnh: node backend/src/modules/crawler/serve-preview.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 4444;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Loại bỏ query params
  const cleanUrl = req.url.split('?')[0];
  let filePath = path.join(BASE_DIR, cleanUrl === '/' ? 'preview-places.html' : cleanUrl);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Không tìm thấy file: ${cleanUrl}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 Lỗi máy chủ: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  const previewUrl = `http://localhost:${PORT}/preview-places.html`;
  console.log('================================================================');
  console.log(`🚀 MÁY CHỦ XEM TRƯỚC DỮ LIỆU ĐANG CHẠY TẠI:`);
  console.log(`👉 ${previewUrl}`);
  console.log('================================================================');
  console.log(`Dữ liệu nạp trực tiếp từ: backend/src/modules/crawler/data/staged-google-places.json`);
  console.log(`Nhấn Ctrl + C để dừng máy chủ bất cứ lúc nào.\n`);

  if (process.argv.includes('--no-open')) return;

  // Tìm và mở bằng Brave Browser
  const localAppData = process.env.LOCALAPPDATA || '';
  const bravePath = path.join(localAppData, 'BraveSoftware/Brave-Browser/Application/brave.exe');

  if (fs.existsSync(bravePath)) {
    console.log(`🦁 Đang tự động mở trên trình duyệt Brave...`);
    exec(`"${bravePath}" "${previewUrl}"`, (err) => {
      if (err) console.warn('Không thể mở tự động Brave:', err.message);
    });
  } else {
    // Mở bằng trình duyệt mặc định của Windows
    exec(`start "" "${previewUrl}"`);
  }
});
