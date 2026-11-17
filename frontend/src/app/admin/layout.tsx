import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/components/AdminShell";

export const metadata: Metadata = {
  title: "Quản trị hệ thống | TripGenie",
  description: "Cổng quản trị dữ liệu, kiểm duyệt cộng đồng và an ninh hệ thống TripGenie",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
