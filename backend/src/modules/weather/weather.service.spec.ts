import {
  WEATHER_THRESHOLDS,
  WeatherCondition,
  WeatherSource,
  buildWeatherGuidance,
} from './weather.constants';
import { WeatherService, resolveItineraryCoordinates } from './weather.service';

describe('WeatherService & Weather Guidance', () => {
  const fixedNow = new Date('2026-11-11T02:00:00.000Z'); // 2026-11-11 09:00 VN (+07:00)

  it('returns cached forecast from Redis without calling Open-Meteo HTTP', async () => {
    const redisMock = {
      get: jest.fn().mockResolvedValue(
        JSON.stringify({
          '2026-11-12': {
            tempMinC: 23,
            tempMaxC: 29,
            precipitationProbabilityMax: 75,
            uvIndexMax: 5.5,
            weatherCode: 63,
          },
        }),
      ),
      set: jest.fn(),
    };

    const service = new WeatherService(undefined, redisMock as any);
    const httpSpy = jest.spyOn((service as any).httpClient, 'get');

    const res = await service.getTripWeather({
      lat: 16.0544,
      lng: 108.2022,
      destination: 'Đà Nẵng',
      startDate: '2026-11-12',
      totalDays: 1,
      now: fixedNow,
    });

    expect(httpSpy).not.toHaveBeenCalled();
    expect(redisMock.get).toHaveBeenCalledWith('weather:v1:16.05:108.20');
    expect(res.hasForecastDays).toBe(true);
    expect(res.days[0]).toMatchObject({
      dayNumber: 1,
      date: '2026-11-12',
      source: WeatherSource.FORECAST,
      isForecast: true,
      condition: WeatherCondition.RAINY,
      tempMinC: 23,
      tempMaxC: 29,
      precipitationProbabilityMax: 75,
    });
  });

  it('fetches Open-Meteo forecast for days in 16-day horizon, caches to Redis, and dedupes concurrent calls', async () => {
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = new WeatherService(undefined, redisMock as any);

    const httpSpy = jest
      .spyOn((service as any).httpClient, 'get')
      .mockResolvedValue({
        data: {
          daily: {
            time: ['2026-11-11', '2026-11-12'],
            weather_code: [0, 80],
            temperature_2m_min: [24.2, 22.8],
            temperature_2m_max: [35.6, 28.4],
            precipitation_probability_max: [10, 82],
            uv_index_max: [8.6, 4.1],
          },
        },
      });

    const [resA, resB] = await Promise.all([
      service.getTripWeather({
        lat: 16.054,
        lng: 108.202,
        destination: 'Đà Nẵng',
        startDate: '2026-11-11',
        totalDays: 2,
        now: fixedNow,
      }),
      service.getTripWeather({
        lat: 16.051,
        lng: 108.204,
        destination: 'Đà Nẵng',
        startDate: '2026-11-11',
        totalDays: 2,
        now: fixedNow,
      }),
    ]);

    expect(httpSpy).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledTimes(1);
    expect(resA.days[0].condition).toBe(WeatherCondition.SUNNY);
    expect(resA.days[0].tempMaxC).toBe(36);
    expect(resB.days[1].condition).toBe(WeatherCondition.RAINY);
    expect(resA.guidance).toContain('Nắng gắt/UV cao');
    expect(resA.guidance).toContain('ƯU TIÊN điểm trong nhà');
  });

  it('negative-caches an Open-Meteo failure so repeated requests do not wait on the timeout again', async () => {
    const service = new WeatherService();
    const httpSpy = jest
      .spyOn((service as any).httpClient, 'get')
      .mockRejectedValue(new Error('Open-Meteo timeout'));
    const params = {
      lat: 16.0544,
      lng: 108.2022,
      destination: 'Đà Nẵng',
      startDate: '2026-11-12',
      totalDays: 1,
      now: fixedNow,
    };

    const first = await service.getTripWeather(params);
    const second = await service.getTripWeather(params);

    expect(httpSpy).toHaveBeenCalledTimes(1);
    expect(first.days[0]).toMatchObject({
      source: WeatherSource.SEASONAL_AVERAGE,
      degradedFromForecast: true,
    });
    expect(second.days[0].source).toBe(WeatherSource.SEASONAL_AVERAGE);
  });

  it('uses seasonal climate fallback without calling Open-Meteo when trip is outside forecast horizon or undated', async () => {
    const service = new WeatherService();
    const httpSpy = jest.spyOn((service as any).httpClient, 'get');

    const farFuture = await service.getTripWeather({
      lat: 11.94,
      lng: 108.45,
      destination: 'Đà Lạt',
      startDate: '2027-01-15',
      totalDays: 2,
      now: fixedNow,
    });

    const undated = await service.getTripWeather({
      lat: 21.02,
      lng: 105.83,
      destination: 'Hà Nội',
      startDate: null,
      totalDays: 1,
      now: fixedNow,
    });

    expect(httpSpy).not.toHaveBeenCalled();
    expect(farFuture.hasForecastDays).toBe(false);
    expect(farFuture.days[0].source).toBe(WeatherSource.SEASONAL_AVERAGE);
    expect(farFuture.days[0].isForecast).toBe(false);
    expect(farFuture.days[0].condition).toBe(WeatherCondition.COLD);
    expect(farFuture.guidance).toContain('trung bình khí hậu theo mùa');

    expect(undated.days[0].source).toBe(WeatherSource.SEASONAL_AVERAGE);
    expect(undated.days[0].date).toBeNull();
  });

  it('degrades gracefully to seasonal fallback without throwing when Redis and Open-Meteo both fail', async () => {
    const brokenRedis = {
      get: jest.fn().mockRejectedValue(new Error('Redis down')),
      set: jest.fn().mockRejectedValue(new Error('Redis down')),
    };
    const service = new WeatherService(undefined, brokenRedis as any);
    jest
      .spyOn((service as any).httpClient, 'get')
      .mockRejectedValue(new Error('Open-Meteo timeout'));

    const res = await service.getTripWeather({
      lat: 16.05,
      lng: 108.2,
      destination: 'Đà Nẵng',
      startDate: '2026-11-12',
      totalDays: 1,
      now: fixedNow,
    });

    expect(res.hasForecastDays).toBe(false);
    expect(res.days[0]).toMatchObject({
      source: WeatherSource.SEASONAL_AVERAGE,
      isForecast: false,
      degradedFromForecast: true,
    });
  });

  it('resolves coordinates prioritizing activity centroid then TravelArea bbox center', () => {
    const fromStops = resolveItineraryCoordinates({
      destinations: [
        { place: { latitude: 16.0, longitude: 108.2 } },
        { place: { latitude: 16.1, longitude: 108.3 } },
      ],
      area: {
        bboxMinLat: 10,
        bboxMaxLat: 12,
        bboxMinLng: 100,
        bboxMaxLng: 102,
      },
    });
    expect(fromStops).toEqual({ lat: 16.05, lng: 108.25 });

    const fromBbox = resolveItineraryCoordinates({
      destinations: [],
      area: {
        bboxMinLat: 15.9,
        bboxMaxLat: 16.1,
        bboxMinLng: 108.1,
        bboxMaxLng: 108.3,
      },
    });
    expect(fromBbox).toEqual({ lat: 16, lng: 108.2 });
  });

  it('buildWeatherGuidance respects centralized threshold constants', () => {
    const msg = buildWeatherGuidance([
      {
        dayNumber: 1,
        date: '2026-11-12',
        source: WeatherSource.FORECAST,
        isForecast: true,
        condition: WeatherCondition.MILD,
        labelVi: 'Có mây',
        tempMinC: 24,
        tempMaxC: WEATHER_THRESHOLDS.HEAT_TEMP_C,
        tempAvgC: 29,
        precipitationProbabilityMax: WEATHER_THRESHOLDS.RAIN_PROB_HIGH,
        uvIndexMax: WEATHER_THRESHOLDS.UV_HIGH,
        weatherCode: 2,
      },
    ]);

    expect(msg).toContain('ƯU TIÊN điểm trong nhà');
    expect(msg).toContain('Nắng gắt/UV cao');
  });
});
