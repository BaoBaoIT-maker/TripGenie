# Hướng dẫn crawl dữ liệu TripGenie

Bộ crawler lấy thông tin địa điểm từ Google Maps bằng Playwright và Brave, lưu ra file để xem và duyệt, sau đó import vào PostgreSQL.

Luồng sử dụng gồm **crawl → xem trước → xuất danh sách đã duyệt → import → kiểm tra database**.

## 1. Chuẩn bị

- Cài Node.js 22 và trình duyệt Brave trên Windows. `config.js` tìm Brave trong các thư mục cài đặt thông dụng của Windows. Chế độ `--headless` vẫn cần Brave.
- Có kết nối Internet để truy cập Google Maps.
- Cài dependency của backend, gồm Playwright.

Từ thư mục gốc dự án, mở PowerShell và chạy lần lượt các lệnh sau.

```powershell
cd backend
npm install
npm run crawl:check
```

**Các lệnh npm bên dưới đều chạy trong thư mục `backend`.** Đường dẫn bắt đầu bằng `src/` cũng được tính từ thư mục này.

`crawl:check` kiểm tra dependency, entrypoint, đường dẫn, lưu file, gộp dữ liệu, sao lưu và dữ liệu cho trang preview. Crawler chỉ cần database ở bước setup hoặc import.

## 2. Crawl địa điểm

### Chạy thử và gộp vào dữ liệu hiện có

```powershell
npm run crawl -- danang 100 --append
```

Lệnh này đặt mục tiêu lấy 100 địa điểm Đà Nẵng và gộp kết quả vào file hiện có. Mặc định, Brave mở cửa sổ để bạn theo dõi.

### Các khu vực đang hỗ trợ

| Khu vực | Tham số thường dùng | Alias khác |
| --- | --- | --- |
| Đà Nẵng | `danang` | `dn`, `da-nang` |
| TP.HCM | `hcm` | `hcmc`, `saigon`, `tphcm`, `ho-chi-minh` |
| Lâm Đồng | `lamdong` | `lam-dong`, `dalat`, `da-lat` |
| An Giang | `angiang` | `an-giang`, `chaudoc`, `chau-doc` |

Cấu hình từ khóa, khu vực và quận/huyện nằm trong `config.js`. Để thêm tỉnh, cần bổ sung cấu hình tỉnh tại đây và alias nhận diện trong `google-maps-crawler.js`.

### Các danh mục

| Tham số | Nội dung |
| --- | --- |
| `stay`, `hotel` | Lưu trú |
| `food` | Ẩm thực |
| `cafe` | Cà phê, đồ uống |
| `sightseeing`, `tourism` | Tham quan, di tích |
| `nightlife` | Vui chơi, về đêm |
| `shopping` | Mua sắm |

Khi bỏ qua danh mục, crawler phân bổ mục tiêu cho cả sáu nhóm.

```powershell
# Chỉ cào ẩm thực TP.HCM
npm run crawl -- hcm food 200 --append

# Chỉ cào cà phê Lâm Đồng
npm run crawl -- lamdong cafe 200 --append

# Tìm theo từ khóa cụ thể
npm run crawl -- --province hcm --topic cafe --query "cà phê Thủ Đức" --total 100 --append

# Chạy ngầm
npm run crawl -- angiang 500 --append --headless
```

### Tùy chọn dòng lệnh

| Tùy chọn | Ý nghĩa |
| --- | --- |
| `--province`, `-p` | Chọn tỉnh/thành |
| `--total`, `-n` | Mục tiêu số địa điểm của lần chạy |
| `--topic`, `-t` | Chọn danh mục |
| `--query`, `-q` | Tìm bằng từ khóa tùy chọn |
| `--append` | Gộp kết quả vào dữ liệu đã lưu |
| `--headless` | Chạy Brave ở chế độ ẩn cửa sổ |

Dấu `--` đầu tiên trong lệnh npm giúp chuyển các tham số phía sau cho crawler. Mặc định khi chạy `npm run crawl` là Đà Nẵng, 200 địa điểm, tất cả danh mục.

**Khi thiếu `--append`, kết quả mới thay thế file dữ liệu hiện tại.** Trước khi ghi, crawler có bước sao lưu file JSON cũ vào `data/history/`. Để tích lũy nhiều tỉnh, dùng `--append` trong từng lần chạy.

```powershell
npm run crawl -- danang 1000 --append
npm run crawl -- hcm 1000 --append
npm run crawl -- lamdong 1000 --append
npm run crawl -- angiang 1000 --append
```

Chạy lần lượt và chờ mỗi lệnh kết thúc. Con số truyền vào là mục tiêu thu thập của lần chạy. Số thực tế có thể thấp hơn khi hết ứng viên đạt bộ lọc hoặc dữ liệu bị bỏ qua do trùng.

## 3. File dữ liệu

Các đường dẫn dưới đây tính từ thư mục crawler này.

Thư mục `data/` được Git bỏ qua. Sau khi clone repo, chạy crawl để tạo dữ liệu hoặc chép dữ liệu đã sao lưu vào thư mục này trước khi mở preview và import.

| Đường dẫn | Nội dung |
| --- | --- |
| `data/staged-google-places.json` | Kết quả crawl được dùng cho bước import khi chưa có file duyệt |
| `data/staged-google-places.js` | Bản dữ liệu để trang preview đọc qua biến JavaScript |
| `data/approved-places.json` | Danh sách xuất sau khi duyệt, được ưu tiên khi import |
| `data/history/` | Các bản sao JSON trước khi ghi dữ liệu mới |

Ảnh được lưu dưới dạng URL trong dữ liệu. Một số trường như tagline, mẹo và thời lượng gợi ý được tạo từ mẫu trong `editorial-generator.js`. Nên kiểm tra lại nội dung, giờ mở cửa và mức giá khi duyệt.

Kết quả được ghi khi vòng crawl hoàn tất. Dừng tiến trình giữa chừng có thể làm mất kết quả đang giữ trong bộ nhớ của lần chạy đó.

## 4. Xem trước và duyệt

```powershell
npm run crawl:preview
```

Mở [trang preview](http://localhost:4444/preview-places.html), kiểm tra địa điểm và chọn các mục muốn nhập vào database. Nếu muốn tự mở trình duyệt, dùng lệnh sau.

```powershell
npm run crawl:preview -- --no-open
```

Sau khi chọn xong, bấm nút xuất file duyệt. Trình duyệt tải về `approved-places.json`. Chép file này vào vị trí dưới đây, ghi đè bản duyệt cũ nếu có.

```text
backend/src/modules/crawler/data/approved-places.json
```

Các thao tác tick trên trang preview chỉ thay đổi dữ liệu trong trang đang mở. Cần xuất file và chép vào đúng thư mục để bước import dùng lựa chọn của bạn.

Crawler hiện đặt `approved: true` cho các mục vượt qua bộ lọc tự động. Nếu thiếu `approved-places.json`, importer lấy các mục có `approved !== false` trong file staged, bao gồm cả mục chưa có trường `approved`. Vì vậy, nên xuất file duyệt để kiểm soát chính xác danh sách import.

Mỗi đợt duyệt mới cần thay file `approved-places.json` tương ứng. Nếu để bản cũ, importer tiếp tục ưu tiên bản đó.

## 5. Chuẩn bị PostgreSQL

Các script setup và import đọc `DATABASE_URL` từ môi trường hoặc `backend/.env`. Tham số `--db=...` có độ ưu tiên cao nhất. Giữ thông tin đăng nhập database trong file môi trường được Git bỏ qua.

### Kiểm tra database đã có

Đặt `DATABASE_URL` trong `backend/.env`, rồi chạy lệnh chỉ đọc sau.

```powershell
npm run crawl:setup-db -- --check
```

Lệnh hiển thị host kết nối cùng số bảng, danh mục, khu vực, địa điểm và ảnh. Xác nhận đúng database trước khi import.

### Kết nối database Render bằng file riêng

Lưu External Database URL của database vào `backend/.env.render.local` với khóa `DATABASE_URL`. Dùng Node.js 22 để nạp file này khi chạy script.

```powershell
node --env-file=.env.render.local src/modules/crawler/setup-render-db.js --check
```

File `.env.render.local` được nạp qua `--env-file`; chạy lệnh npm thông thường chỉ tự đọc `.env`.

### Khởi tạo database rỗng

Lệnh `npm run crawl:setup-db` có chức năng chạy `init.sql`, các migration và seed dữ liệu nền.

Với kết nối đã cấu hình, khởi tạo database bằng lệnh sau.

```powershell
npm run crawl:setup-db
```

Để khởi tạo Render bằng file môi trường riêng, chạy lệnh tương ứng.

```powershell
node --env-file=.env.render.local src/modules/crawler/setup-render-db.js
```

Migration `20261111130000_group_place_proposal_status` bổ sung `status` và `destination_id` trước khi migration v2 tạo chỉ mục. Setup có thể chạy lại trên database đã khởi tạo và tiếp tục từ lần setup từng dừng ở lỗi thiếu `status`. Script vẫn chạy các SQL tương thích trực tiếp, chưa ghi lịch sử vào Prisma Migrate. Đọc lỗi SQL trước khi thử lại trên database có dữ liệu đang sử dụng.

Script dùng `init.sql` và các migration tương thích để tạo schema, sau đó gọi lại `prisma/seed_geojson.js` của backend để seed danh mục, quốc gia, 34 tỉnh/thành và vùng du lịch. Các điểm trung chuyển được nạp bằng `transit-hubs.seed.sql`.

## 6. Import dữ liệu đã duyệt

Với database được cấu hình qua `backend/.env`, chạy lệnh sau.

```powershell
npm run crawl:import
```

Với database Render được lưu trong file môi trường riêng, dùng lệnh sau.

```powershell
node --env-file=.env.render.local src/modules/crawler/import-approved.js
```

Importer ưu tiên `data/approved-places.json`, sau đó mới đọc file staged. Dữ liệu được ghi vào `places`, `place_images` và `place_sources`. Đọc thống kê cuối lệnh để kiểm tra số mục thêm mới, trùng và lỗi, rồi kiểm tra lại database.

```powershell
npm run crawl:setup-db -- --check
```

Nếu vừa import Render, dùng lại lệnh kiểm tra có `--env-file=.env.render.local` để kiểm tra đúng đích kết nối.

Importer tra ID tỉnh bằng `areaSlug`, tra ID danh mục bằng `categorySlug` của database đích. Với file crawl cũ thiếu `areaSlug`, importer nhận diện bốn tỉnh đang hỗ trợ qua `areaName` trong cấu hình. File tùy chỉnh chỉ có ID cần được đối chiếu với database đích. Mục có tỉnh hoặc danh mục không tồn tại sẽ báo lỗi. Khi có lỗi import, tiến trình kết thúc với mã lỗi để có thể kiểm tra bằng `$LASTEXITCODE` trong PowerShell.

**Tùy chọn `--clean` xóa toàn bộ địa điểm cũ** rồi nạp lại. Nó có thể ảnh hưởng dữ liệu tham chiếu và số địa điểm của lịch trình. Chỉ dùng khi chủ động muốn thay toàn bộ tập dữ liệu và đã có bản sao phù hợp.

## 7. Giới hạn và xử lý lỗi

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Không tìm thấy Brave | Kiểm tra vị trí cài Brave và hàm `getBravePath()` trong `config.js` |
| Không tìm thấy Playwright hoặc `pg` | Chạy `npm install` trong `backend` |
| Preview báo cổng `4444` đang được dùng | Dừng phiên preview cũ bằng `Ctrl + C` rồi chạy lại |
| Crawl ít hơn mục tiêu | Kiểm tra log truy vấn và bộ lọc, thử từ khóa cụ thể bằng `--query` |
| Import tiếp tục đọc dữ liệu cũ | Kiểm tra file `data/approved-places.json` đang được ưu tiên |
| Chưa có tỉnh hoặc danh mục tương ứng | Kiểm tra `areaSlug`, `areaName`, `categorySlug` và dữ liệu nền trong database |
| Database báo thiếu bảng hoặc cột | Kiểm tra schema, migration và chạy setup trên database cần khởi tạo |

Cả bước gộp file và importer hiện nhận diện trùng chủ yếu theo tên địa điểm. Hai chi nhánh cùng tên hoặc địa điểm cùng tên ở tỉnh khác có thể bị gộp hoặc bỏ qua.

Crawler hiện chạy với Brave trên Windows. Để chạy trình duyệt trực tiếp trên Render cần bổ sung hỗ trợ trình duyệt Linux. Luồng hiện tại là crawl trên máy Windows rồi import vào PostgreSQL Render.

## 8. Các file chính

Để kiểm tra setup và import trên PostgreSQL thử, cấu hình biến `CRAWLER_TEST_DATABASE_URL` trỏ tới máy chủ thử có quyền tạo database rồi chạy lệnh sau.

```powershell
npm run crawl:check-db
```

Bài kiểm tra tự tạo database riêng, thử setup lần đầu và lần hai, kiểm tra dữ liệu nền, import mẫu kiểm thử của bốn tỉnh và chạy import lại. Database thử được dọn trong bước kết thúc. Bài kiểm tra chạy được cả khi chưa có dữ liệu crawl.

| File | Trách nhiệm |
| --- | --- |
| `google-maps-crawler.js` | Đọc tham số và khởi chạy |
| `crawler.js` | Điều phối truy vấn, lấy địa điểm và lọc kết quả |
| `config.js` | Tỉnh/thành, từ khóa và đường dẫn Brave |
| `extractor.js` | Lấy thông tin từ trang chi tiết Google Maps |
| `category-mapper.js` | Ánh xạ danh mục và thông tin giá |
| `editorial-generator.js` | Tạo nội dung gợi ý theo mẫu |
| `storage.js` | Ghi JSON/JS, gộp và sao lưu |
| `serve-preview.js`, `preview-places.html` | Xem và duyệt dữ liệu |
| `setup-render-db.js` | Kiểm tra hoặc khởi tạo database |
| `import-approved.js` | Import địa điểm vào PostgreSQL |
