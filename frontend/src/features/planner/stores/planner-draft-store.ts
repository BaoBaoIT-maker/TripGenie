import { create } from "zustand";
import { Planner } from "@/types/planner";
import { normalizePlanner } from "../model/planner-draft";

interface PlannerDraftState {
  draft: Planner | null;
  isDirty: boolean;
  load: (planner: Planner) => void;
  patch: (partial: Partial<Planner>) => void;
  replace: (planner: Planner) => void;
  markSaved: (savedPlanner: Planner) => void;
  reset: () => void;
}

export const usePlannerDraftStore = create<PlannerDraftState>((set) => ({
  draft: null,
  isDirty: false,
  load: (planner: Planner) =>
    set({
      draft: normalizePlanner(planner),
      isDirty: false,
    }),
  patch: (partial: Partial<Planner>) =>
    set((state) => {
      if (!state.draft) return state;
      const updated = {
        ...state.draft,
        ...partial,
      };
      return {
        draft: normalizePlanner(updated),
        isDirty: true,
      };
    }),
  replace: (planner: Planner) =>
    set({
      draft: normalizePlanner(planner),
      isDirty: true,
    }),
  markSaved: (savedPlanner: Planner) =>
    set({
      draft: normalizePlanner(savedPlanner),
      isDirty: false,
    }),
  reset: () =>
    set({
      draft: null,
      isDirty: false,
    }),
}));
