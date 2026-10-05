import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/** Compact place record sent to the LLM as grounding context. */
export interface PlannerPlace {
  id: string;
  name: string;
  cat: string;
  rating: unknown;
  tags: string[];
}

export interface PlannerActivity {
  placeId?: string | null;
  placeName?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface PlannerDay {
  dayNumber: number;
  theme?: string;
  activities?: PlannerActivity[];
}

export interface PlannerPlan {
  title?: string;
  description?: string;
  days?: PlannerDay[];
}

export interface PlannerParams {
  originCity: string;
  destCity: string;
  destLat?: number;
  destLng?: number;
  totalDays: number;
  budgetLevel: string;
  pace: string;
  travelStyles: string[];
  customPrompt?: string;
  places: PlannerPlace[];
}

/**
 * Gemini HTTP client + deterministic fallback for day planning.
 * Single responsibility: turn (params + candidate places) into a PlannerPlan. No DB access.
 */
@Injectable()
export class GeminiPlannerService {
  private readonly logger = new Logger(GeminiPlannerService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-flash-lite-latest',
    );
    this.httpClient = axios.create({ timeout: 25000 });
  }

  /**
   * Calls Gemini to synthesize days, flow, and timing. Never throws: falls back to a deterministic plan.
   */
  async plan(params: PlannerParams): Promise<PlannerPlan> {
    const modelPath = this.modelName.startsWith('models/')
      ? this.modelName
      : `models/${this.modelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${this.apiKey}`;

    try {
      const response = await this.httpClient.post(url, {
        contents: [{ parts: [{ text: this.buildPrompt(params) }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      });

      const text: string | undefined =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleanJson) as PlannerPlan;
    } catch (err) {
      const e = err as Error;
      this.logger.error(`Gemini planning error: ${e.message}`, e.stack);
      return this.buildFallbackPlan(params);
    }
  }

  private buildPrompt(params: PlannerParams): string {
    const sampleLat = params.destLat ? Number(params.destLat.toFixed(4)) : 10.2289;
    const sampleLng = params.destLng ? Number(params.destLng.toFixed(4)) : 103.9572;

    return `Bạn là TripGenie - Chuyên gia thiết kế lịch trình du lịch thông minh tại Việt Nam.
Nhiệm vụ: Sắp xếp một lịch trình ${params.totalDays} ngày tại ${params.destCity}, xuất phát từ ${params.originCity}.
Phong cách: ${params.travelStyles.join(', ')} | Nhịp độ: ${params.pace} | Ngân sách: ${params.budgetLevel}.
${params.customPrompt ? `Yêu cầu riêng của khách: ${params.customPrompt}` : ''}

Quy tắc bắt buộc:
1. Tránh đi ziczac: Gom các điểm gần nhau vào cùng một ngày hoặc một buổi.
2. Tôn trọng nhịp sinh hoạt:
   - Sáng (08:00 - 11:30): Tham quan, ngắm cảnh ngoài trời hoặc bảo tàng.
   - Trưa (11:30 - 13:00): Ăn trưa đặc sản địa phương, nghỉ ngơi.
   - Chiều (13:30 - 17:30): Hoạt động trải nghiệm, check-in, cà phê.
   - Tối (18:00 - 21:30): Ăn tối, chợ đêm, phố đi bộ, dạo cảnh.
3. ƯU TIÊN SỬ DỤNG các địa điểm có sẵn trong danh sách CANDIDATE_PLACES dưới đây (map đúng ID). Nếu cần bổ sung món ăn đường phố/quán cà phê đặc trưng mà danh sách thiếu, hãy đặt placeId null.
4. GIỚI HẠN ĐỊA BÀN NGHIÊM NGẶT: Mọi hoạt động và địa điểm (kể cả khi tự đề xuất có placeId null) BẮT BUỘC phải nằm tại địa phương ${params.destCity} (tham chiếu tọa độ quanh vĩ độ ${sampleLat}, kinh độ ${sampleLng}). TUYỆT ĐỐI KHÔNG xếp các địa điểm thuộc tỉnh/thành phố khác vào lịch trình này.
5. Phân bổ cân bằng thể loại trải nghiệm: Mỗi ngày phải có sự kết hợp hài hòa giữa điểm tham quan/ngắm cảnh/văn hóa, điểm ăn uống ẩm thực địa phương, và không gian check-in/thư giãn. Tuyệt đối không xếp cả ngày chỉ toàn quán cà phê hoặc chỉ toàn điểm ăn uống.
6. TỌA ĐỘ VÀ ĐỊA CHỈ: Với mỗi hoạt động, BẮT BUỘC cung cấp "latitude" và "longitude" thực tế tại ${params.destCity} (các điểm trong ngày phải có tọa độ khác nhau theo cung đường hợp lý) và "address" cụ thể để hệ thống vẽ bản đồ và dẫn đường OSRM.

DANH SÁCH CANDIDATE_PLACES:
${JSON.stringify(params.places.slice(0, 30))}

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (KHÔNG bọc trong markdown tick \`\`\`json):
{
  "title": "Tên hành trình hấp dẫn",
  "description": "Mô tả ngắn gọn điểm nhấn của chuyến đi",
  "days": [
    {
      "dayNumber": 1,
      "theme": "Chủ đề của ngày",
      "activities": [
        {
          "placeId": "uuid-chính-xác-từ-danh-sách-hoặc-null",
          "placeName": "Tên địa điểm",
          "startTime": "08:30",
          "endTime": "10:30",
          "durationMinutes": 120,
          "notes": "Gợi ý trải nghiệm cụ thể",
          "latitude": ${sampleLat},
          "longitude": ${sampleLng},
          "address": "Địa chỉ cụ thể tại ${params.destCity}"
        }
      ]
    }
  ]
}`;

  }

  /**
   * Fallback deterministic plan in case LLM is unreachable (Resilience guarantee).
   */
  private buildFallbackPlan(
    params: Pick<PlannerParams, 'destCity' | 'totalDays' | 'places'>,
  ): PlannerPlan {
    const slots = [
      { start: '08:30', end: '10:30', dur: 120, note: 'Khám phá buổi sáng' },
      { start: '11:30', end: '13:00', dur: 90, note: 'Ăn trưa đặc sản' },
      { start: '14:00', end: '16:30', dur: 150, note: 'Tham quan chiều' },
      { start: '18:30', end: '20:30', dur: 120, note: 'Dạo phố và ngắm cảnh đêm' },
    ];
    const days: PlannerDay[] = [];
    let placeIdx = 0;

    for (let d = 1; d <= params.totalDays; d++) {
      const activities = slots.map((t) => {
        const place = params.places[placeIdx++ % Math.max(1, params.places.length)];
        return {
          placeId: place?.id ?? null,
          placeName: place?.name || `Điểm tham quan tại ${params.destCity}`,
          startTime: t.start,
          endTime: t.end,
          durationMinutes: t.dur,
          notes: t.note,
        };
      });
      days.push({
        dayNumber: d,
        theme: `Khám phá các điểm nổi bật ${params.destCity} - Ngày ${d}`,
        activities,
      });
    }

    return {
      title: `Hành trình khám phá ${params.destCity} ${params.totalDays} ngày`,
      description: `Lịch trình được tối ưu hóa theo các địa điểm nổi bật tại ${params.destCity}.`,
      days,
    };
  }
}
