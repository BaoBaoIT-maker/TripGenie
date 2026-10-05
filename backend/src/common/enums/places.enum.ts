/**
 * Centralized enums for the Places & Search module.
 * Eliminates magic strings and enforces strict type safety.
 */

export enum PlaceSortBy {
  DISTANCE = 'DISTANCE',
  RATING = 'RATING',
  POPULARITY = 'POPULARITY',
  NAME = 'NAME',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}
