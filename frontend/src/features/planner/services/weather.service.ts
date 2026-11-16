import {
  DESTINATION_CLIMATE_MAP,
  BASELINE_VIETNAM_CLIMATE,
  WEATHER_THEMES,
  type ItineraryWeather,
  type MonthClimateEntry,
} from '../constants/climate.constants';

/**
 * Normalizes user-entered destination strings into climate lookup keys.
 */
function normalizeDestinationKey(destination?: string | null): string {
  if (!destination) return 'baseline';
  const clean = destination
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean.includes('da nang') || clean.includes('hoi an') || clean.includes('quang nam')) return 'danang';
  if (clean.includes('da lat') || clean.includes('lam dong')) return 'dalat';
  if (clean.includes('phu quoc') || clean.includes('kien giang')) return 'phuquoc';
  if (clean.includes('ha noi')) return 'hanoi';
  if (clean.includes('sa pa') || clean.includes('sapa') || clean.includes('lao cai')) return 'sapa';
  if (clean.includes('ninh binh') || clean.includes('trang an')) return 'ninhbinh';
  if (clean.includes('nha trang') || clean.includes('khanh hoa')) return 'nhatrang';

  return 'baseline';
}

/**
 * Parses month (1-12) from string or Date. Defaults to current month if absent.
 */
function extractMonth(dateInput?: string | Date | null): number {
  if (!dateInput) return new Date().getMonth() + 1;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length >= 2) {
      const monthNum = parseInt(parts[1], 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) return monthNum;
    }
  }
  const dateObj = new Date(dateInput);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.getMonth() + 1;
  }
  return new Date().getMonth() + 1;
}

/**
 * Strategy interface for resolving weather data for travel itineraries.
 * Adheres to SOLID Open/Closed Principle (OCP): easily extensible with
 * real-time weather providers (Open-Meteo, AccuWeather, or backend microservices)
 * without touching caller UI components.
 */
export interface WeatherResolverStrategy {
  resolve(destination?: string | null, startDate?: string | Date | null): ItineraryWeather;
}

/**
 * Default Strategy: Pure O(1) in-memory seasonal climate resolver.
 * Backed by verified regional climate records in climate.constants.ts.
 * Zero network latency, zero external API costs, zero database overhead.
 */
export class SeasonalClimateResolver implements WeatherResolverStrategy {
  resolve(destination?: string | null, startDate?: string | Date | null): ItineraryWeather {
    const key = normalizeDestinationKey(destination);
    const month = extractMonth(startDate);

    const climateMap = DESTINATION_CLIMATE_MAP[key] || BASELINE_VIETNAM_CLIMATE;
    const entry: MonthClimateEntry = climateMap[month] || BASELINE_VIETNAM_CLIMATE[month] || {
      temp: 28,
      condition: 'SUNNY',
      summary: 'Nắng đẹp',
    };

    const theme = WEATHER_THEMES[entry.condition] || WEATHER_THEMES.SUNNY;

    return {
      temperature: entry.temp,
      condition: entry.condition,
      label: `${entry.temp}°C • ${entry.summary}`,
      icon: theme.icon,
      iconUrl: theme.iconUrl,
      badgeClass: theme.badgeClass,
      heroBadgeClass: theme.heroBadgeClass,
      isForecast: false,
    };
  }
}

/**
 * Singleton service instance.
 * ponytail: Pure in-memory seasonal resolver. Upgrade path: instantiate a HybridWeatherResolver
 * that delegates to an Open-Meteo client for trips within <= 7 days.
 */
export const weatherService: WeatherResolverStrategy = new SeasonalClimateResolver();

/**
 * Convenient pure facade function for UI components.
 */
export function getItineraryWeather(
  destination?: string | null,
  startDate?: string | Date | null
): ItineraryWeather {
  return weatherService.resolve(destination, startDate);
}
