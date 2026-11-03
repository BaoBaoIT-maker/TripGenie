"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TOUR_TEMPLATES, type TourTemplate } from "@/features/planner/config/tour-templates";

const ItineraryWizardModal = dynamic(() => import("@/features/planner/components/ItineraryWizardModal"), {
  loading: () => <p role="status" className="text-center text-sm text-muted-foreground">Đang mở trình tạo lịch…</p>,
});

export function TourTemplates() {
  const [preview, setPreview] = useState<TourTemplate | null>(null);
  const [planning, setPlanning] = useState<TourTemplate | null>(null);

  const startPlanning = (tour: TourTemplate) => {
    setPreview(null);
    setPlanning(tour);
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {TOUR_TEMPLATES.map((tour) => (
          <article key={tour.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="relative aspect-video overflow-hidden bg-muted">
              <Image src={tour.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              <span className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-foreground">Lịch trình tham khảo</span>
            </div>
            <div className="flex h-auto flex-col gap-4 p-5">
              <p className="flex items-center gap-2 text-sm text-primary"><MapPin className="size-4" aria-hidden="true" />{tour.destination}<span className="text-muted-foreground">· {tour.days.length} ngày</span></p>
              <h3 className="font-heading text-xl font-bold leading-snug">{tour.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{tour.description}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setPreview(tour)} aria-label={`Xem lịch trình ${tour.destination}`}>Xem lịch trình</Button>
                <Button className="min-h-11 rounded-xl" onClick={() => startPlanning(tour)} aria-label={`Lên lịch chuyến ${tour.destination}`}>Lên lịch chuyến này<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-xl sm:p-8">
          {preview && (
            <>
              <DialogTitle className="pr-6 font-heading text-2xl">{preview.title}</DialogTitle>
              <DialogDescription>{preview.description} Đây là gợi ý tham khảo; thời gian mở cửa, vé và chi phí cần kiểm tra trước chuyến đi.</DialogDescription>
              <ol className="space-y-5 py-3">
                {preview.days.map((day, index) => (
                  <li key={day.title} className="border-l-2 border-primary/25 pl-4">
                    <h4 className="font-semibold text-primary">Ngày {index + 1}: {day.title}</h4>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{day.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground">Bạn có thể đổi ngày, điểm khởi hành và phương tiện. AI sẽ dựa trên gợi ý này để tạo lịch trình riêng theo dữ liệu hiện có.</p>
              <Button className="min-h-11 rounded-xl" onClick={() => startPlanning(preview)}><CalendarDays className="size-4" aria-hidden="true" />Lên lịch chuyến này</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {planning && <ItineraryWizardModal key={planning.id} isOpen onClose={() => setPlanning(null)} initialTemplate={planning} />}
    </>
  );
}
