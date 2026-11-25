import { z } from 'zod';
import { MAX_TRIP_DAYS } from '../config/itinerary-wizard-options';
import { calculateTripDays, toLocalDateString } from '../model/itinerary-format';

const today = () => toLocalDateString(new Date());

export const itineraryWizardSchema = z
  .object({
    originCity: z.string().min(1, 'Vui lòng chọn điểm khởi hành'),
    destinationCity: z.string().min(1, 'Vui lòng chọn điểm đến'),
    startDate: z.string().min(1, 'Vui lòng chọn ngày đi'),
    endDate: z.string().min(1, 'Vui lòng chọn ngày về'),
    transitMode: z.string().min(1, 'Vui lòng chọn phương tiện'),
    intracityMode: z.string().min(1, 'Vui lòng chọn di chuyển nội thành'),
    budgetLevel: z.string().min(1, 'Vui lòng chọn mức ngân sách'),
    travelStyles: z.array(z.string()).min(1, 'Chọn ít nhất 1 phong cách'),
    pace: z.string().optional(),
  })
  .refine((d) => d.originCity !== d.destinationCity, {
    message: 'Điểm khởi hành và điểm đến không được trùng nhau',
    path: ['destinationCity'],
  })
  .refine((d) => d.startDate >= today(), {
    message: 'Ngày đi không thể trong quá khứ',
    path: ['startDate'],
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'Ngày về phải sau hoặc bằng ngày đi',
    path: ['endDate'],
  })
  .refine(
    (d) => {
      const days = calculateTripDays(d.startDate, d.endDate);
      return days !== null && days <= MAX_TRIP_DAYS;
    },
    { message: `Chuyến đi tối đa ${MAX_TRIP_DAYS} ngày`, path: ['endDate'] },
  );

export type ItineraryWizardValues = z.infer<typeof itineraryWizardSchema>;
