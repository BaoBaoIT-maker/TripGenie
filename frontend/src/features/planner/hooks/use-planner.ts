import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { plannerService } from "@/services/planner.service";
import { Planner, UpdatePlannerInput } from "@/types/planner";

export const plannerKeys = {
  all: ["planners"] as const,
  lists: () => [...plannerKeys.all, "list"] as const,
  detail: (id: string) => [...plannerKeys.all, "detail", id] as const,
};

export function usePlannersQuery() {
  return useQuery({
    queryKey: plannerKeys.lists(),
    queryFn: () => plannerService.getPlanners(),
  });
}

export function usePlannerQuery(id: string) {
  return useQuery({
    queryKey: plannerKeys.detail(id),
    queryFn: () => plannerService.getPlannerById(id),
    enabled: Boolean(id),
  });
}

export function useCreatePlannerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planner: Planner) => plannerService.createPlanner(planner),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.all });
      queryClient.setQueryData(plannerKeys.detail(created.id), created);
    },
  });
}

export function useUpdatePlannerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlannerInput | Planner }) =>
      plannerService.updatePlanner(id, input),
    onSuccess: (saved, { id }) => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
      queryClient.setQueryData(plannerKeys.detail(id), saved);
    },
  });
}

export function useCreatePlannerInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      plannerId,
      input,
    }: {
      plannerId: string;
      input: { userId: string; permission: "viewer" | "editor" };
    }) => plannerService.createPlannerInvitation(plannerId, input),
    onSuccess: (_, { plannerId }) => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.detail(plannerId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
    },
  });
}

export function useUpdateMockInvitationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      plannerId,
      invitationId,
      status,
    }: {
      plannerId: string;
      invitationId: string;
      status: "accepted" | "declined";
    }) => plannerService.updateMockInvitationStatus(plannerId, invitationId, status),
    onSuccess: (updatedPlanner, { plannerId }) => {
      queryClient.setQueryData(plannerKeys.detail(plannerId), updatedPlanner);
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
    },
  });
}
