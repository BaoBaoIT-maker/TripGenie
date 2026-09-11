import { Place } from "./place";

export interface PlannerItem {
  id: string;
  placeId: string;
  place: Place;
  startTime: string; // "08:30"
  endTime?: string; // "10:00"
  durationMinutes: number;
  estimatedCost: number;
  costNote?: string; // "120.000đ / 2 người"
  travelTimeToNext?: {
    distanceKm: number;
    durationMinutes: number;
    mode: "motorbike" | "car" | "walk";
  };
  note?: string;
  order: number;
}

export interface PlannerDay {
  day: number;
  date: string; // "2026-10-24"
  title?: string; // "Săn mây & Cafe thung lũng"
  items: PlannerItem[];
  dayTotalDistanceKm?: number;
  dayTotalCost?: number;
}

export type PlannerStatus = "draft" | "saved";
export type PlannerMemberRole = "owner" | "editor" | "viewer";
export type PlannerInvitationStatus = "pending" | "accepted" | "declined";

export interface PlannerMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: PlannerMemberRole;
}

export interface PlannerInvitation {
  id: string;
  plannerId: string;
  invitee: PlannerMember;
  permission: "editor" | "viewer";
  status: PlannerInvitationStatus;
  createdAt: string;
}

export interface InviteCandidate {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface Planner {
  id: string;
  title: string;
  description?: string;
  destination: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  durationText: string; // "3N2Đ"
  budget: number;
  estimatedTotalCost: number;
  people: number;
  style: string;
  coverImage: string;
  status?: PlannerStatus;
  members?: PlannerMember[];
  invitations?: PlannerInvitation[];
  createdAt?: string;
  updatedAt?: string;
  authorName?: string;
  authorAvatar?: string;
  days: PlannerDay[];
  summaryRoute?: string; // "Túi Mơ To → Dinh 1 → Lẩu Gà Tao Ngộ → Chợ Đêm"
  matchScore?: number; // 98%
}

export interface AiPlannerInput {
  title: string;
  description: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  people: number;
  interests: string[];
  wishlistPlaces: string[];
  tripStyle: string;
  pace: string;
  companion: string;
  transport: string;
  extraNotes: string;
  coverImage: string;
}

export type UpdatePlannerInput = Omit<Planner, "id" | "createdAt">;

export interface AiProposalChange {
  id: string;
  title: string;
  description: string;
  benefit: string;
  applied?: boolean;
}

