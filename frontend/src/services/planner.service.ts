import {
  Planner,
  AiPlannerInput,
  ManualPlannerInput,
  UpdatePlannerInput,
  PlannerInvitation,
  InviteCandidate,
  PlannerDay,
  PlannerItem,
} from "@/types/planner";
import { plannerRepository } from "@/features/planner/data/planner.repository";
import { normalizePlanner, getInviteConflict } from "@/features/planner/model/planner-draft";
import { buildManualPlanner } from "@/features/planner/model/manual-planner";
import { MOCK_USERS, CURRENT_USER } from "@/mocks/data/users";
import { MOCK_PLACES } from "@/mocks/data/places";

function getDaysBetween(startDateStr: string, endDateStr: string): string[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    const today = new Date().toISOString().split("T")[0];
    return [startDateStr || today];
  }

  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates.length > 0 ? dates : [startDateStr];
}

export const plannerService = {
  async getPlanners(): Promise<Planner[]> {
    return plannerRepository.list();
  },

  async getPlannerById(id: string): Promise<Planner | null> {
    return plannerRepository.get(id);
  },

  async createPlanner(planner: Planner): Promise<Planner> {
    return plannerRepository.create(planner);
  },

  async createManualPlanner(input: ManualPlannerInput): Promise<Planner> {
    const now = new Date();
    const id = `manual-plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = {
      userId: CURRENT_USER.id,
      displayName: CURRENT_USER.displayName,
      email: CURRENT_USER.email,
      avatarUrl: CURRENT_USER.avatarUrl,
      role: "owner" as const,
    };
    const planner = buildManualPlanner(input, owner, id, now);
    return plannerRepository.create(planner);
  },

  async updatePlanner(id: string, input: UpdatePlannerInput | Planner): Promise<Planner> {
    return plannerRepository.update(id, input);
  },

  async generateAiPlanner(input: AiPlannerInput): Promise<Planner> {
    const dates = getDaysBetween(input.startDate, input.endDate);
    const durationDays = dates.length;
    const durationText =
      durationDays === 1 ? "Trong ngày" : `${durationDays}N${durationDays - 1}Đ`;

    const availablePlaces = MOCK_PLACES.length > 0 ? MOCK_PLACES : [];
    let placeCursor = 0;

    const days: PlannerDay[] = dates.map((dateStr, dIndex) => {
      const dayNum = dIndex + 1;
      const dayPlaces = [
        availablePlaces[placeCursor % availablePlaces.length],
        availablePlaces[(placeCursor + 1) % availablePlaces.length],
      ];
      placeCursor += 2;

      const items: PlannerItem[] = dayPlaces.map((place, idx) => ({
        id: `item-${dayNum}-${idx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        placeId: place.id,
        place,
        startTime: idx === 0 ? "08:30" : "14:00",
        endTime: idx === 0 ? "11:30" : "17:00",
        durationMinutes: 180,
        estimatedCost: idx === 0 ? 150000 : 250000,
        order: idx + 1,
        note: `Khám phá ${place.name}`,
      }));

      return {
        day: dayNum,
        date: dateStr,
        title: `Ngày ${dayNum}: Khám phá ${input.destination || "điểm đến"}`,
        items,
        dayTotalCost: items.reduce((acc, it) => acc + it.estimatedCost, 0),
      };
    });

    const routeSummary = days
      .flatMap((d) => d.items.map((i) => i.place.name))
      .slice(0, 4)
      .join(" → ");

    const generated: Planner = {
      id: `ai-plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: input.title || `Khám phá ${input.destination || "Việt Nam"}`,
      description: input.description || "",
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      durationDays,
      durationText,
      budget: input.budget || 5000000,
      estimatedTotalCost: 0,
      people: input.people || 2,
      style: input.tripStyle || "Khám phá & Trải nghiệm",
      coverImage:
        input.coverImage ||
        "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80",
      status: "draft",
      members: [
        {
          userId: CURRENT_USER.id,
          displayName: CURRENT_USER.displayName,
          email: CURRENT_USER.email,
          avatarUrl: CURRENT_USER.avatarUrl,
          role: "owner",
        },
      ],
      invitations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorName: CURRENT_USER.displayName,
      authorAvatar: CURRENT_USER.avatarUrl,
      days,
      summaryRoute: routeSummary,
      matchScore: 95,
    };

    return normalizePlanner(generated);
  },

  async searchInviteCandidates(query: string): Promise<InviteCandidate[]> {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) {
      return [];
    }
    return MOCK_USERS.filter(
      (user) =>
        user.displayName.toLowerCase().includes(trimmed) ||
        user.email.toLowerCase().includes(trimmed)
    );
  },

  async createPlannerInvitation(
    plannerId: string,
    input: { userId: string; permission: "viewer" | "editor" }
  ): Promise<PlannerInvitation> {
    const planner = await plannerRepository.get(plannerId);
    if (!planner) {
      throw new Error(`Planner not found: ${plannerId}`);
    }

    const candidate = MOCK_USERS.find((u) => u.id === input.userId);
    if (!candidate) {
      throw new Error(`User candidate not found: ${input.userId}`);
    }

    const conflict = getInviteConflict(planner, CURRENT_USER.id, candidate.id);
    if (conflict) {
      throw new Error(`Invite conflict: ${conflict}`);
    }

    const newInvitation: PlannerInvitation = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      plannerId,
      invitee: {
        userId: candidate.id,
        displayName: candidate.displayName,
        email: candidate.email,
        avatarUrl: candidate.avatarUrl,
        role: input.permission,
      },
      permission: input.permission,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const updatedInvitations = [...(planner.invitations || []), newInvitation];
    await plannerRepository.update(plannerId, {
      ...planner,
      invitations: updatedInvitations,
    });

    return newInvitation;
  },

  async updateMockInvitationStatus(
    plannerId: string,
    invitationId: string,
    status: "accepted" | "declined"
  ): Promise<Planner> {
    const planner = await plannerRepository.get(plannerId);
    if (!planner) {
      throw new Error(`Planner not found: ${plannerId}`);
    }

    const invitation = (planner.invitations || []).find((inv) => inv.id === invitationId);
    if (!invitation) {
      throw new Error(`Invitation not found: ${invitationId}`);
    }

    const nextInvitations = (planner.invitations || []).filter(
      (inv) => inv.id !== invitationId
    );
    const nextMembers = [...(planner.members || [])];

    if (status === "accepted") {
      const alreadyMember = nextMembers.some((m) => m.userId === invitation.invitee.userId);
      if (!alreadyMember) {
        nextMembers.push({
          userId: invitation.invitee.userId,
          displayName: invitation.invitee.displayName,
          email: invitation.invitee.email,
          avatarUrl: invitation.invitee.avatarUrl,
          role: invitation.permission,
        });
      }
    }

    return plannerRepository.update(plannerId, {
      ...planner,
      members: nextMembers,
      invitations: nextInvitations,
    });
  },
};
