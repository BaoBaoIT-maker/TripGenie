import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CommunityClientShell } from "@/components/community/CommunityClientShell";
import { CommunityPageSkeleton } from "@/components/community/CommunityPageSkeleton";
import { COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import type {
  CommunityFeedResponse,
  SidebarDiscoveryResponse,
} from "@/types/community";

export const metadata: Metadata = {
  title: "Cộng đồng Du lịch & Chia sẻ Lịch trình | TripGenie Vietnam",
  description:
    "Khám phá kinh nghiệm du lịch thực tế, check-in 9:16 mới nhất từ các Thổ địa xác thực và nhân bản lịch trình thông minh chỉ với 1 chạm.",
};

const SERVER_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

const SSR_FETCH_TIMEOUT_MS = 2500;

async function fetchServerCommunityJson<T>(
  endpoint: string,
  cookieHeader: string
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);

    const response = await fetch(`${SERVER_API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) return null;
    const json = (await response.json()) as Record<string, unknown>;
    if (json && typeof json === "object" && "data" in json && "success" in json) {
      return json.data as T;
    }
    return json as unknown as T;
  } catch {
    return null;
  }
}

async function CommunityServerContent() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [initialSidebarDiscovery, initialFeedFirstPage] = await Promise.all([
    fetchServerCommunityJson<SidebarDiscoveryResponse>(
      "/community/sidebar-discovery",
      cookieHeader
    ),
    fetchServerCommunityJson<CommunityFeedResponse>(
      `/community/posts?sort=LATEST&limit=${COMMUNITY_UI_CONSTANTS.DEFAULT_FEED_PAGE_SIZE}`,
      cookieHeader
    ),
  ]);

  return (
    <CommunityClientShell
      initialSidebarDiscovery={initialSidebarDiscovery}
      initialFeedFirstPage={initialFeedFirstPage}
    />
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<CommunityPageSkeleton />}>
      <CommunityServerContent />
    </Suspense>
  );
}
