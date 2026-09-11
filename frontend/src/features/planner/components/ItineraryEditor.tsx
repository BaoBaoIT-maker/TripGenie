"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Calendar, MapPin } from "lucide-react";
import { Planner, PlannerItem } from "@/types/planner";
import { Place } from "@/types/place";
import {
  reorderPlannerItem,
  movePlannerItem,
  upsertPlannerItem,
  removePlannerItem,
} from "../model/planner-draft";
import { SortablePlannerItem } from "./SortablePlannerItem";
import { PlannerItemDialog } from "./PlannerItemDialog";
import { PlaceSearchDialog } from "./PlaceSearchDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ItineraryEditorProps {
  planner: Planner;
  onUpdateDraft: (updated: Planner) => void;
}

export function ItineraryEditor({
  planner,
  onUpdateDraft,
}: ItineraryEditorProps) {
  const [activeDayNumber, setActiveDayNumber] = useState(1);

  // Stop add/edit state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // Search catalog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  // Delete confirm state
  const [itemToDelete, setItemToDelete] = useState<PlannerItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const days = planner.days || [];
  const currentDay = days.find((d) => d.day === activeDayNumber) || days[0];
  const items = currentDay?.items || [];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeDay = active.data.current?.day as number | undefined;
    const overDay = (over.data.current?.day as number | undefined) || activeDayNumber;

    if (activeDay === undefined) return;

    let updated: Planner;
    if (activeDay === overDay) {
      updated = reorderPlannerItem(
        planner,
        activeDay,
        String(active.id),
        String(over.id)
      );
    } else {
      updated = movePlannerItem(
        planner,
        String(active.id),
        overDay,
        String(over.id)
      );
    }
    onUpdateDraft(updated);
  };

  const handleEditItem = (item: PlannerItem) => {
    setEditingItem(item);
    setSelectedPlace(null);
    setItemDialogOpen(true);
  };

  const handleDeletePrompt = (item: PlannerItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const updated = removePlannerItem(planner, itemToDelete.id);
    onUpdateDraft(updated);
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleOpenSearch = () => {
    setSearchDialogOpen(true);
  };

  const handleSelectPlaceFromSearch = (place: Place) => {
    setSelectedPlace(place);
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleSaveItem = (item: PlannerItem) => {
    const updated = upsertPlannerItem(planner, activeDayNumber, item);
    onUpdateDraft(updated);
    setEditingItem(null);
    setSelectedPlace(null);
  };

  return (
    <div className="space-y-6">
      {/* Day Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {days.map((day) => {
          const isActive = day.day === activeDayNumber;
          return (
            <button
              key={day.day}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveDayNumber(day.day)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border border-border/80 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <Calendar className="size-3.5" />
              <span>Ngày {day.day}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {day.items?.length || 0} điểm
              </span>
            </button>
          );
        })}
      </div>

      {/* Itinerary for Active Day */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Lịch trình Ngày {activeDayNumber}
            </h3>
            {currentDay?.date && (
              <p className="text-xs text-muted-foreground">
                {currentDay.date} — {currentDay.title || "Khám phá các điểm đến"}
              </p>
            )}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-2">
                  <div className="flex justify-center text-muted-foreground">
                    <MapPin className="size-8 opacity-40" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Chưa có địa điểm nào trong ngày này
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Bắt đầu xây dựng lịch trình bằng cách bấm nút tìm địa điểm mới bên dưới.
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <SortablePlannerItem
                    key={item.id}
                    item={item}
                    dayNumber={activeDayNumber}
                    onEdit={handleEditItem}
                    onDelete={handleDeletePrompt}
                  />
                ))
              )}

              {/* End-of-day Place Search Action */}
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenSearch}
                className="w-full h-12 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/80 hover:bg-primary/5 text-muted-foreground hover:text-primary gap-2 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Tìm địa điểm mới</span>
              </Button>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Item Add/Edit Dialog */}
      <PlannerItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        place={selectedPlace}
        dayNumber={activeDayNumber}
        onSave={handleSaveItem}
      />

      {/* Catalog Search Dialog */}
      <PlaceSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectPlace={handleSelectPlaceFromSearch}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa điểm dừng</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa điểm dừng &ldquo;
              {itemToDelete?.place?.name || "này"}&rdquo; khỏi lịch trình Ngày {activeDayNumber}?
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-xs rounded-xl"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              className="text-xs rounded-xl font-bold"
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
