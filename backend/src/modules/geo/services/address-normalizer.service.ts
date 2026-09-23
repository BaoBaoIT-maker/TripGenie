import { Injectable, Logger } from '@nestjs/common';
import { IAddressNormalizerService } from '../interfaces/geo.interface';

/**
 * Service chuẩn hóa địa chỉ Việt Nam (Clean SOLID):
 * - Chuẩn hóa ký tự Unicode (NFC)
 * - Mở rộng các từ viết tắt phổ biến (TP., Q., P., H., TT., TX.)
 * - Loại bỏ khoảng trắng thừa, dấu phẩy thừa
 */
@Injectable()
export class AddressNormalizerService implements IAddressNormalizerService {
  private readonly logger = new Logger(AddressNormalizerService.name);

  // Từ viết tắt sang dạng đầy đủ (xếp theo độ ưu tiên từ cụ thể -> chung)
  private readonly ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
    // 1. Tên tỉnh/thành viết tắt xử lý trước
    [/\b(TPHCM|TP\.HCM|Tp\s*HCM)\b/gi, 'Thành phố Hồ Chí Minh'],
    [/\b(TPHN|TP\.HN|Tp\s*HN)\b/gi, 'Thành phố Hà Nội'],
    [/\b(TPĐN|TP\.ĐN|Tp\s*ĐN|Da\s*Nang)\b/gi, 'Thành phố Đà Nẵng'],

    // 2. Tiền tố đô thị có dấu chấm
    [/\b(TP\.|T\.P\.)\s*/gi, 'Thành phố '],
    [/\b(TT\.|T\.T\.)\s*/gi, 'Thị trấn '],
    [/\b(TX\.|T\.X\.)\s*/gi, 'Thị xã '],

    // 3. Quận, Phường có số hoặc có dấu chấm rõ ràng
    [/\bQ\.?\s*(\d+)\b/gi, 'Quận $1'],
    [/\bQ\.\s*([a-zA-ZÀ-ỹ]+)/gi, 'Quận $1'],
    [/\bP\.?\s*(\d+)\b/gi, 'Phường $1'],
    [/\bP\.\s*([a-zA-ZÀ-ỹ]+)/gi, 'Phường $1'],
    [/\bH\.\s*([a-zA-ZÀ-ỹ]+)/gi, 'Huyện $1'],
    [/\bX\.\s*([a-zA-ZÀ-ỹ]+)/gi, 'Xã $1'],
  ];

  /**
   * Chuẩn hóa chuỗi địa chỉ thô
   * @param rawAddress Chuỗi địa chỉ đầu vào từ crawler hoặc user
   */
  normalize(rawAddress: string): string {
    if (!rawAddress || !rawAddress.trim()) {
      return '';
    }

    // 1. Chuẩn hóa Unicode NFC & loại bỏ khoảng trắng thừa
    let normalized = rawAddress.normalize('NFC').trim();
    normalized = normalized.replace(/\s+/g, ' ');

    // 2. Mở rộng từ viết tắt theo thứ tự ưu tiên
    for (const [regex, replacement] of this.ABBREVIATIONS) {
      normalized = normalized.replace(regex, replacement);
    }

    // 3. Chuẩn hóa dấu phẩy và khoảng trắng
    normalized = normalized.replace(/\s*,\s*/g, ', ');
    normalized = normalized.replace(/,{2,}/g, ',');
    normalized = normalized.replace(/^,\s*|,\s*$/g, '');

    return normalized;
  }

  /**
   * Bỏ dấu tiếng Việt để phục vụ so sánh không dấu (Fuzzy match)
   */
  removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }
}
