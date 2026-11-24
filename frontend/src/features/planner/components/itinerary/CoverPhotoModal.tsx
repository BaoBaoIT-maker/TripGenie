'use client';

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useI18n, type MessageKey } from '@/i18n';
import { COVER_PHOTO_PRESETS } from '../../constants/itinerary.constants';

async function compressImageToFit(file: File, maxStringLength = 65000): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Không thể tải dữ liệu ảnh'));
      image.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh'));
    reader.readAsDataURL(file);
  });

  let width = img.width;
  let height = img.height;
  const initialMaxDim = 1200;

  if (width > initialMaxDim || height > initialMaxDim) {
    const ratio = Math.min(initialMaxDim / width, initialMaxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không thể khởi tạo Canvas');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.78;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  let attempts = 0;
  while (dataUrl.length > maxStringLength && attempts < 12) {
    attempts++;
    if (quality > 0.45) {
      quality -= 0.12;
    } else {
      width = Math.max(360, Math.round(width * 0.85));
      height = Math.max(200, Math.round(height * 0.85));
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      quality = 0.65;
    }
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}

async function ensureDataUrlFits(dataUrl: string, maxStringLength = 65000): Promise<string> {
  if (!dataUrl.startsWith('data:image') || dataUrl.length <= maxStringLength) {
    return dataUrl;
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể tải dữ liệu ảnh'));
    image.src = dataUrl;
  });

  let width = img.width;
  let height = img.height;
  const initialMaxDim = 1200;
  if (width > initialMaxDim || height > initialMaxDim) {
    const ratio = Math.min(initialMaxDim / width, initialMaxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.75;
  let compressed = canvas.toDataURL('image/jpeg', quality);
  let attempts = 0;
  while (compressed.length > maxStringLength && attempts < 10) {
    attempts++;
    if (quality > 0.45) {
      quality -= 0.12;
    } else {
      width = Math.max(360, Math.round(width * 0.85));
      height = Math.max(200, Math.round(height * 0.85));
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      quality = 0.65;
    }
    compressed = canvas.toDataURL('image/jpeg', quality);
  }
  return compressed;
}

interface CoverPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCover: string;
  onSave: (newCoverUrl: string) => Promise<void>;
  isSaving?: boolean;
}

function CoverPhotoModalBody({
  currentCover,
  onClose,
  onSave,
  isSaving,
}: {
  currentCover: string;
  onClose: () => void;
  onSave: (newCoverUrl: string) => Promise<void>;
  isSaving: boolean;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [selectedUrl, setSelectedUrl] = useState<string>(currentCover);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleApplyCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      toast.error(t('planner.coverPhoto.toasts.invalidUrl'));
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image')) {
      toast.error(t('planner.coverPhoto.toasts.urlProtocol'));
      return;
    }
    setSelectedUrl(trimmed);
    toast.success(t('planner.coverPhoto.toasts.previewApplied'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('planner.coverPhoto.toasts.invalidFileType'));
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      toast.error(t('planner.coverPhoto.toasts.fileTooLarge'));
      return;
    }

    setIsUploading(true);
    try {
      const compressed = await compressImageToFit(file);
      setSelectedUrl(compressed);
      toast.success(t('planner.coverPhoto.toasts.compressedSuccess'));
    } catch {
      toast.error(t('planner.coverPhoto.toasts.readFileError'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!selectedUrl) {
      toast.error(t('planner.coverPhoto.toasts.noImageSelected'));
      return;
    }
    try {
      const safeUrl = await ensureDataUrlFits(selectedUrl);
      await onSave(safeUrl);
      onClose();
    } catch {
      // Error surfaced by caller
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center border border-[#D0E7FF]">
            <i className="fa-solid fa-camera text-sm" aria-hidden="true" />
          </div>
          <div>
            <h2 id="cover-photo-modal-title" className="text-base font-bold text-slate-900">
              {t('planner.coverPhoto.title')}
            </h2>
            <p className="text-xs text-slate-500">{t('planner.coverPhoto.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label={t('planner.common.closeDialog')}
          className="size-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Live Preview Box */}
      <div className="px-6 pt-5 pb-2 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          {t('planner.coverPhoto.previewLabel')}
        </p>
        <div className="relative h-36 sm:h-44 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedUrl || currentCover}
            alt={t('planner.coverPhoto.previewAlt')}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
          <div className="absolute bottom-3 left-4 text-white text-xs font-semibold flex items-center gap-1.5">
            <i className="fa-regular fa-image text-xs" aria-hidden="true" />
            <span>{t('planner.coverPhoto.previewOverlay')}</span>
          </div>
        </div>
      </div>

      {/* Tab Selection */}
      <div className="px-6 pt-2 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-white text-[#0194F3] font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <i className="fa-regular fa-images text-xs" aria-hidden="true" />
            <span>{t('planner.coverPhoto.tabPresets')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-[#0194F3] font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-upload text-xs" aria-hidden="true" />
            <span>{t('planner.coverPhoto.tabUpload')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'url'
                ? 'bg-white text-[#0194F3] font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-link text-xs" aria-hidden="true" />
            <span>{t('planner.coverPhoto.tabUrl')}</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 overflow-y-auto flex-1 min-h-[180px]">
        {activeTab === 'presets' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COVER_PHOTO_PRESETS.map((preset) => {
              const isChosen = selectedUrl === preset.url;
              const presetTitle = t(`planner.coverPhoto.presets.${preset.id}.title` as MessageKey);
              const presetLocation = t(
                `planner.coverPhoto.presets.${preset.id}.location` as MessageKey,
              );
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedUrl(preset.url)}
                  className={`group relative rounded-xl overflow-hidden border-2 text-left transition-colors cursor-pointer aspect-video bg-slate-100 ${
                    isChosen
                      ? 'border-[#0194F3] ring-2 ring-[#0194F3]/30'
                      : 'border-slate-200 hover:border-[#0194F3]/50'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preset.url}
                    alt={presetTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  {isChosen && (
                    <div className="absolute top-2 right-2 size-5 rounded-full bg-[#0194F3] text-white flex items-center justify-center shadow">
                      <i className="fa-solid fa-check text-[10px]" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-2 right-2 text-white text-[11px] leading-tight">
                    <p className="font-bold truncate">{presetTitle}</p>
                    <p className="text-[10px] text-slate-300 truncate">{presetLocation}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="cover-file-input"
            />
            <div className="size-12 rounded-2xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center mb-3">
              {isUploading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xl" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-cloud-arrow-up text-xl" aria-hidden="true" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              {t('planner.coverPhoto.uploadHeading')}
            </h3>
            <p className="text-xs text-slate-500 text-center max-w-xs mb-4">
              {t('planner.coverPhoto.uploadDesc')}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-camera text-xs" aria-hidden="true" />
              <span>{t('planner.coverPhoto.chooseFile')}</span>
            </button>
          </div>
        )}

        {activeTab === 'url' && (
          <div className="space-y-3 py-2">
            <div>
              <label htmlFor="cover-custom-url-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('planner.coverPhoto.urlLabel')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cover-custom-url-input"
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 h-10 px-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  className="h-10 px-3.5 bg-[#10243A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t('planner.coverPhoto.previewUrlBtn')}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {t('planner.coverPhoto.urlHint')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/70 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-9 px-5 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
              <span>{t('planner.common.saving')}</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-check text-xs" aria-hidden="true" />
              <span>{t('planner.common.saveChanges')}</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

export default function CoverPhotoModal({
  isOpen,
  onClose,
  currentCover,
  onSave,
  isSaving = false,
}: CoverPhotoModalProps) {
  return (
    <AppModalPortal
      open={isOpen}
      onClose={onClose}
      ariaLabelledBy="cover-photo-modal-title"
      maxWidthClass="max-w-2xl"
      dialogClassName="flex flex-col max-h-[90vh]"
      disableClose={isSaving}
      mobileBottomSheet
    >
      {isOpen && (
        <CoverPhotoModalBody
          key={currentCover}
          currentCover={currentCover}
          onClose={onClose}
          onSave={onSave}
          isSaving={isSaving}
        />
      )}
    </AppModalPortal>
  );
}
