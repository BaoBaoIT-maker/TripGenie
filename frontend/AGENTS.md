<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Quy tắc giao diện TripGenie

- Đọc [DESIGN.md](../DESIGN.md) trước khi thiết kế hoặc sửa UI. Trang chủ mới và logo la bàn xanh dương là chuẩn nhận diện; các trang dùng cùng hệ xanh dương, nền trắng ánh lam và chữ navy.
- Dùng token trong `src/app/globals.css` qua `bg-primary`, `text-primary-foreground`, `bg-secondary`, `border-border`, `ring-ring` và các alias tương ứng. Khi cần đổi bộ màu, sửa token tập trung theo bảng light/dark trong DESIGN.md; không hard-code màu riêng cho từng trang.
- Dành xanh thương hiệu sáng cho nhận diện, dùng `primary` có độ tương phản phù hợp cho nút và liên kết. Giữ màu ngữ nghĩa của lỗi, cảnh báo, thành công và ký hiệu bản đồ.
- Tái dùng Navbar, MobileNavSheet và UI primitives. Kiểm tra mobile/desktop, light/dark và focus bàn phím khi cập nhật giao diện.
