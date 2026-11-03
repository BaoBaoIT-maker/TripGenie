'use client';

import * as React from 'react';
import Image from 'next/image';
import { Check, Upload, Loader2, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PRESET_AVATARS, DEFAULT_AVATAR } from '@/config/avatars';
import { useUpdateAvatar } from '../hooks/use-update-avatar';

interface AvatarPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl?: string | null;
  userFullName?: string;
}

function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn tệp hình ảnh (PNG, JPG, WebP)'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('Kích thước ảnh tối đa là 10MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 400; // 400x400 standard circle avatar
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không thể xử lý hình ảnh này'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc tệp từ thiết bị'));
    reader.readAsDataURL(file);
  });
}

export function AvatarPickerModal({
  open,
  onOpenChange,
  currentAvatarUrl,
  userFullName,
}: AvatarPickerModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const initialUrl = currentAvatarUrl || DEFAULT_AVATAR;
  const [selectedUrl, setSelectedUrl] = React.useState<string>(initialUrl);
  const [customAvatarUrl, setCustomAvatarUrl] = React.useState<string | null>(() => {
    const isPreset = PRESET_AVATARS.some((p) => p.url === currentAvatarUrl);
    return isPreset || !currentAvatarUrl ? null : currentAvatarUrl;
  });
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const updateAvatarMutation = useUpdateAvatar();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) {
      setSelectedUrl(currentAvatarUrl || DEFAULT_AVATAR);
      const isPreset = PRESET_AVATARS.some((p) => p.url === currentAvatarUrl);
      if (!isPreset && currentAvatarUrl) {
        setCustomAvatarUrl(currentAvatarUrl);
      }
      setErrorMessage(null);
    }
  }, [open, currentAvatarUrl]);

  if (!mounted || !open) {
    return null;
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsProcessingFile(true);
    try {
      const dataUrl = await processImageFile(file);
      setCustomAvatarUrl(dataUrl);
      setSelectedUrl(dataUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải ảnh lên';
      setErrorMessage(msg);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (selectedUrl === currentAvatarUrl) {
      onOpenChange(false);
      return;
    }

    setErrorMessage(null);
    try {
      await updateAvatarMutation.mutateAsync(selectedUrl);
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.';
      setErrorMessage(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-6 rounded-3xl">
        <DialogHeader className="text-center sm:text-center pb-2">
          <DialogTitle className="text-lg font-bold font-heading text-center">
            Chọn ảnh đại diện
          </DialogTitle>
        </DialogHeader>

        {/* Selected Preview Circle */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative size-24">
            <Avatar className="size-24 border-3 border-primary/30 shadow-md">
              <AvatarImage src={selectedUrl} alt={userFullName || 'Avatar'} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                {userFullName
                  ? userFullName
                      .split(' ')
                      .filter(Boolean)
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'TG'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
              <Check className="size-3.5 stroke-[3]" />
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Visual Avatar Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-3.5 py-3 justify-items-center max-h-[360px] overflow-y-auto pr-1">
          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
            className={`group relative size-16 rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${
              selectedUrl === customAvatarUrl && customAvatarUrl
                ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
                : 'border-border/90 hover:border-primary hover:bg-muted/50'
            }`}
            title="Tải ảnh từ máy"
          >
            {isProcessingFile ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : customAvatarUrl ? (
              <div className="relative size-full rounded-full overflow-hidden">
                <Image
                  src={customAvatarUrl}
                  alt="Ảnh tải lên"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ImagePlus className="size-4 text-white" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                <Upload className="size-5 stroke-[2.2]" />
                <span className="text-[10px] font-semibold mt-0.5">Tải lên</span>
              </div>
            )}

            {selectedUrl === customAvatarUrl && customAvatarUrl && (
              <div className="absolute -top-1 -right-1 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                <Check className="size-3 stroke-[3]" />
              </div>
            )}
          </button>

          {/* Preset Avatars */}
          {PRESET_AVATARS.map((opt) => {
            const isSelected = selectedUrl === opt.url;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedUrl(opt.url)}
                className={`relative size-16 rounded-full overflow-hidden transition-all cursor-pointer group ${
                  isSelected
                    ? 'ring-3 ring-primary ring-offset-2 scale-105 shadow-md'
                    : 'border-2 border-border/80 hover:border-primary/60 hover:scale-102 opacity-85 hover:opacity-100'
                }`}
                title={opt.name}
              >
                <Image
                  src={opt.url}
                  alt={opt.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                      <Check className="size-3.5 stroke-[3]" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {errorMessage && (
          <p className="text-xs text-destructive text-center font-medium bg-destructive/10 p-2 rounded-xl border border-destructive/20">
            {errorMessage}
          </p>
        )}

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={updateAvatarMutation.isPending || isProcessingFile}
            className="rounded-xl text-xs h-9 px-4"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={updateAvatarMutation.isPending || isProcessingFile}
            className="rounded-xl text-xs h-9 px-5 gap-1.5"
          >
            {updateAvatarMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Lưu thay đổi</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
