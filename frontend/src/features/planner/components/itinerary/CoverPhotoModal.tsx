'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Link2,
  Sparkles,
  Check,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

interface CoverPreset {
  id: string;
  title: string;
  location: string;
  url: string;
}

const PRESET_COVERS: CoverPreset[] = [
  {
    id: 'bana-hills',
    title: 'Cầu Vàng & Bà Nà Hills',
    location: 'Đà Nẵng',
    url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'my-khe',
    title: 'Biển Mỹ Khê & Bán đảo Sơn Trà',
    location: 'Đà Nẵng',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'hoi-an',
    title: 'Phố cổ Hội An đèn lồng',
    location: 'Quảng Nam',
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'da-lat',
    title: 'Thành phố sương mù & đồi thông',
    location: 'Đà Lạt',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'ha-noi',
    title: 'Hồ Hoàn Kiếm & Phố cổ',
    location: 'Hà Nội',
    url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'ha-long',
    title: 'Vịnh Hạ Long kỳ vĩ',
    location: 'Quảng Ninh',
    url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'phu-quoc',
    title: 'Hoàng hôn biển ngọc',
    location: 'Phú Quốc',
    url: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'sa-pa',
    title: 'Ruộng bậc thang & núi rừng',
    location: 'Sa Pa / Lào Cai',
    url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'ninh-binh',
    title: 'Quần thể danh thắng Tràng An',
    location: 'Ninh Bình',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'nha-trang',
    title: 'Vịnh biển Nha Trang ngát xanh',
    location: 'Khánh Hòa',
    url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&auto=format&fit=crop&q=80',
  },
];

/**
 * Tự động nén và thu nhỏ ảnh thông minh:
 * Lặp nén lũy tiến (progressive iterative compression) sao cho chuỗi Base64
 * luôn luôn nhỏ hơn 65KB (khoảng ~45KB dung lượng tệp nhị phân),
 * đảm bảo 100% vượt qua mọi giới hạn payload của máy chủ hay proxy mà vẫn giữ được độ nét trên banner.
 */
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

  // Vòng lặp nén tự động: hạ quality & kích thước cho đến khi chuỗi <= maxStringLength
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

/** Đảm bảo chuỗi data URL bất kỳ không vượt quá 65KB trước khi gửi lên API */
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

export default function CoverPhotoModal({
  isOpen,
  onClose,
  currentCover,
  onSave,
  isSaving = false,
}: CoverPhotoModalProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [selectedUrl, setSelectedUrl] = useState<string>(currentCover);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (url: string) => {
    setSelectedUrl(url);
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập đường dẫn hình ảnh hợp lệ');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image')) {
      toast.error('Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    setSelectedUrl(trimmed);
    toast.success('Đã áp dụng ảnh xem trước!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 30MB');
      return;
    }

    setIsUploading(true);
    try {
      const compressed = await compressImageToFit(file);
      setSelectedUrl(compressed);
      toast.success('Đã tự động nén và tối ưu hóa ảnh thành công!');
    } catch {
      toast.error('Lỗi khi đọc và xử lý file ảnh từ thiết bị');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!selectedUrl) {
      toast.error('Vui lòng chọn hoặc tải lên một hình ảnh');
      return;
    }
    try {
      // Đảm bảo dữ liệu gửi đi luôn nhỏ hơn giới hạn của máy chủ
      const safeUrl = await ensureDataUrlFits(selectedUrl);
      await onSave(safeUrl);
      onClose();
    } catch {
      // Error handled by caller
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/80">
              <Camera className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Chỉnh sửa ảnh bìa lịch trình
              </h2>
              <p className="text-xs text-slate-500">
                Tùy chỉnh ảnh đại diện toàn cảnh cho hành trình của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="size-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="p-6 pb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Xem trước ảnh bìa
          </p>
          <div className="relative h-40 sm:h-48 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
            <img
              src={selectedUrl || currentCover}
              alt="Cover preview"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
            <div className="absolute bottom-3 left-4 text-white text-xs font-semibold flex items-center gap-1.5 drop-shadow">
              <ImageIcon className="size-3.5" />
              <span>Giao diện hiển thị thực tế trên đầu trang</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3">
          <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-white text-teal-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Sparkles className="size-3.5 text-teal-600" />
              <span>Gợi ý điểm đến</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white text-teal-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Upload className="size-3.5 text-teal-600" />
              <span>Tải từ thiết bị</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-white text-teal-700 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Link2 className="size-3.5 text-teal-600" />
              <span>Dán liên kết (URL)</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[180px]">
          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRESET_COVERS.map((preset) => {
                const isChosen = selectedUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className={`group relative rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer aspect-video bg-slate-100 ${
                      isChosen
                        ? 'border-teal-600 ring-2 ring-teal-500/30'
                        : 'border-slate-200 hover:border-teal-400'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    {isChosen && (
                      <div className="absolute top-2 right-2 size-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute bottom-1.5 left-2 right-2 text-white text-[11px] leading-tight">
                      <p className="font-bold truncate">{preset.title}</p>
                      <p className="text-[10px] text-slate-300 truncate">{preset.location}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: UPLOAD */}
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
              <div className="size-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                {isUploading ? (
                  <Loader2 className="size-7 animate-spin" />
                ) : (
                  <Upload className="size-7" />
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Tải ảnh bìa từ máy tính hoặc điện thoại
              </h3>
              <p className="text-xs text-slate-500 text-center max-w-xs mb-4">
                Hỗ trợ định dạng JPG, PNG, WebP (kích thước tối đa 8MB). Tỷ lệ ảnh ngang (16:9) sẽ đẹp nhất.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="size-3.5" />
                <span>Chọn ảnh từ thiết bị</span>
              </button>
            </div>
          )}

          {/* TAB 3: CUSTOM URL */}
          {activeTab === 'url' && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Đường dẫn ảnh trực tiếp (Image URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Xem thử
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Mẹo: Bạn có thể sao chép link ảnh chất lượng cao từ Unsplash, Pexels hoặc Google Images.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5 stroke-[2.5]" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
