import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreatorProfileClientShell } from "@/components/community/CreatorProfileClientShell";
import CreatorProfileLoading from "./loading";
import type { CreatorProfileData } from "@/types/community";
import { deriveHandleFromFullName } from "@/services/community.service";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SERVER_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

const SSR_FETCH_TIMEOUT_MS = 3000;

async function fetchServerProfile(
  identifier: string,
  cookieHeader: string
): Promise<CreatorProfileData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);

    const cleanId = identifier.replace(/^@/, "").trim();
    const response = await fetch(
      `${SERVER_API_BASE_URL}/community/creators/${encodeURIComponent(cleanId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (!response.ok) return null;
    const json = (await response.json()) as Record<string, unknown>;
    const target =
      json && typeof json === "object" && "data" in json && "success" in json
        ? (json.data as Record<string, unknown>)
        : json;

    return (target.profile || target) as CreatorProfileData;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const identifier = decodeURIComponent(resolvedParams.id || "");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const profile = await fetchServerProfile(identifier, cookieHeader);

  if (!profile || !profile.user) {
    return {
      title: "Hồ sơ Thổ địa | TripGenie Vietnam",
      description: "Khám phá các bài chia sẻ và lộ trình du lịch thực tế trên TripGenie.",
    };
  }

  const { user, stats } = profile;
  const handle = user.username
    ? `@${user.username}`
    : deriveHandleFromFullName(user.fullName);
  const title = `${user.fullName} (${handle}) • Hồ sơ Thổ địa | TripGenie`;
  const description =
    user.bio ||
    `Khám phá ${stats.postCount} bài chia sẻ và ${stats.publicItineraryCount} lộ trình du lịch thực tế của ${user.fullName} trên TripGenie.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      username: user.username || undefined,
      images: user.avatarUrl
        ? [
            {
              url: user.avatarUrl,
              width: 400,
              height: 400,
              alt: user.fullName,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: user.avatarUrl ? [user.avatarUrl] : [],
    },
  };
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const identifier = decodeURIComponent(resolvedParams.id || "");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const profile = await fetchServerProfile(identifier, cookieHeader);

  if (!profile || !profile.user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-8 sm:p-10 max-w-md w-full shadow-sm space-y-4">
          <div className="size-16 rounded-full bg-[#F1F5F9] text-[#94A3B8] inline-flex items-center justify-center text-2xl mx-auto">
            <i className="fa-solid fa-user-slash" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-[#0F172A]">
            Không tìm thấy trang cá nhân
          </h1>
          <p className="text-[13px] text-[#64748B] leading-relaxed">
            Tài khoản <span className="font-semibold text-[#0F172A]">@{identifier}</span> không tồn tại hoặc đã ngừng hoạt động.
          </p>
          <div className="pt-2">
            <Link
              href="/community"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] bg-[#0F172A] hover:bg-[#1E293B] text-white text-[13px] font-semibold transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>Quay lại Cộng đồng</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<CreatorProfileLoading />}>
      <CreatorProfileClientShell
        initialProfile={profile}
        identifier={identifier}
      />
    </Suspense>
  );
}
