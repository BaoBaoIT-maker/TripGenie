"use client";

import { useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { MapFilters } from "../types";
import { parseMapSearchParams, mergeMapSearchParams } from "../lib/map-query";

export function useMapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = useMemo(() => parseMapSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  const replaceFilters = useCallback((next: MapFilters) => {
    const query = mergeMapSearchParams(new URLSearchParams(searchParams.toString()), next);
    router.replace(`${pathname}?${query}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return { ...parsed, replaceFilters };
}
