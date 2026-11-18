import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CreatorProfileClientShell } from "@/components/community/CreatorProfileClientShell";
import CreatorProfileLoading from "./loading";
import type { CreatorProfileData } from "@/types/community";
import { deriveHandleFromFullName } from "@/services/community.service";

interface PageProps {
  params: Promise<{ id: string }>;
}

function resolveServerApiBaseUrl(): string {
  const rawTarget =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000";
  const clean = rawTarget.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  const base = clean.startsWith("http") ? clean : "http://localhost:3000";
  return `${base}/api/v1`;
}

const SSR_FETCH_TIMEOUT_MS = 5000;

async function fetchServerProfile(
  identifier: string,
  cookieHeader: string
): Promise<CreatorProfileData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);

    const cleanId = identifier.replace(/^@/, "").trim();
    const baseUrl = resolveServerApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/community/creators/${encodeURIComponent(cleanId)}`,
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

  return (
    <Suspense fallback={<CreatorProfileLoading />}>
      <CreatorProfileClientShell
        initialProfile={profile}
        identifier={identifier}
      />
    </Suspense>
  );
}
