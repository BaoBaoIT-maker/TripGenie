"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CheckCircle2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Place } from "@/types/place";

interface PhotoContributeModalProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoContributeModal({
  place,
  open,
  onOpenChange,
}: PhotoContributeModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith("image/")) {
        toast.error("Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP).");
        return;
      }
      setFile(selected);
      const objectUrl = URL.createObjectURL(selected);
      setPreview(objectUrl);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
    setSubmitted(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Vui lòng chọn ít nhất 1 ảnh để đóng góp.");
      return;
    }

    setSubmitting(true);
    // Simulate upload to backend & save with PENDING status for admin review
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success("Đã gửi ảnh thành công! Đang chờ Quản trị viên duyệt.");
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Camera className="size-4" />
            <span>Đóng góp ảnh thực tế</span>
          </div>
          <DialogTitle className="text-lg font-bold">
            {place?.name || "Địa điểm"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {place?.address || place?.city}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 flex flex-col items-center text-center space-y-3">
            <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <h4 className="text-base font-bold text-foreground">Gửi ảnh thành công!</h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              Cảm ơn bạn đã đóng góp cho cộng đồng. Ảnh của bạn đã được chuyển vào hàng đợi kiểm duyệt của Quản trị viên.
            </p>
            <div className="rounded-lg bg-muted/60 p-3 border text-xs text-left space-y-1 w-full mt-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Quy trình kiểm duyệt chất lượng</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Quản trị viên sẽ kiểm tra độ chính xác và chất lượng ảnh trong vòng 24h trước khi hiển thị công khai trên TripGenie.
              </p>
            </div>
            <Button type="button" onClick={handleClose} className="mt-4 w-full">
              Hoàn tất
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Admin Moderation Notice */}
            <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-900 flex items-start gap-2.5 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-200">
              <ShieldCheck className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Lưu ý kiểm duyệt:</strong> Mọi ảnh đóng góp phải là ảnh chụp thực tế tại địa điểm. Ảnh sẽ được <strong>Admin kiểm duyệt</strong> trước khi xuất hiện trên hệ thống.
              </p>
            </div>

            {/* File Upload Area */}
            <div className="space-y-1.5">
              <label htmlFor="photo-input" className="text-xs font-medium block">
                Chọn ảnh từ thiết bị
              </label>
              {preview ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-muted group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Xem trước ảnh đóng góp"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 rounded-lg bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 backdrop-blur-xs transition-colors"
                  >
                    Thay ảnh khác
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="photo-input"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <Upload className="size-8 text-muted-foreground mb-2" />
                  <span className="text-xs font-semibold text-foreground">
                    Bấm để tải ảnh lên
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Hỗ trợ JPG, PNG, WebP (Tối đa 10MB)
                  </span>
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Caption Input */}
            <div className="space-y-1.5">
              <label htmlFor="photo-caption" className="text-xs font-medium block">
                Mô tả bức ảnh (Tùy chọn)
              </label>
              <Input
                id="photo-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ví dụ: Không gian quán, góc chụp mặt tiền..."
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!file || submitting}
                className="gap-1.5"
              >
                {submitting ? "Đang gửi..." : "Gửi ảnh kiểm duyệt"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
