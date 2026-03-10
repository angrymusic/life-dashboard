import { useEffect, useMemo, useRef, useState } from "react";
import type {
  WeatherLocationSource,
} from "@/feature/widgets/Weather/hooks/useWeatherLocation";
import type { WeatherLocation } from "@/feature/widgets/Weather/libs/openMeteo";
import { useI18n } from "@/shared/i18n/client";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

type WeatherLocationPreset = {
  id: string;
  label: {
    ko: string;
    en: string;
  };
  latitude: number;
  longitude: number;
};

type WeatherLocationSearchItem = {
  label: string;
  latitude: number;
  longitude: number;
};

type WeatherLocationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disableSave?: boolean;
  location: WeatherLocation;
  locationSource: WeatherLocationSource;
  setLocationByCoordinates: (
    params: { latitude: number; longitude: number; label?: string },
    source?: WeatherLocationSource
  ) => Promise<void>;
  refreshCurrentLocation: () => Promise<boolean>;
};

const LOCATION_OPTION_CURRENT = "__current__";
const LOCATION_OPTION_SEARCH = "__search__";
const LOCATION_MATCH_TOLERANCE = 0.01;

const WEATHER_LOCATION_PRESETS: WeatherLocationPreset[] = [
  {
    id: "seoul",
    label: { ko: "서울", en: "Seoul" },
    latitude: 37.5665,
    longitude: 126.978,
  },
  {
    id: "busan",
    label: { ko: "부산", en: "Busan" },
    latitude: 35.1796,
    longitude: 129.0756,
  },
  {
    id: "incheon",
    label: { ko: "인천", en: "Incheon" },
    latitude: 37.4563,
    longitude: 126.7052,
  },
  {
    id: "daegu",
    label: { ko: "대구", en: "Daegu" },
    latitude: 35.8722,
    longitude: 128.6025,
  },
  {
    id: "daejeon",
    label: { ko: "대전", en: "Daejeon" },
    latitude: 36.3504,
    longitude: 127.3845,
  },
  {
    id: "gwangju",
    label: { ko: "광주", en: "Gwangju" },
    latitude: 35.1595,
    longitude: 126.8526,
  },
  {
    id: "ulsan",
    label: { ko: "울산", en: "Ulsan" },
    latitude: 35.5384,
    longitude: 129.3114,
  },
  {
    id: "jeju",
    label: { ko: "제주", en: "Jeju" },
    latitude: 33.4996,
    longitude: 126.5312,
  },
];

function isSameCoordinate(a: number, b: number) {
  return Math.abs(a - b) <= LOCATION_MATCH_TOLERANCE;
}

function findPresetByCoordinates(latitude: number, longitude: number) {
  return WEATHER_LOCATION_PRESETS.find(
    (preset) =>
      isSameCoordinate(preset.latitude, latitude) &&
      isSameCoordinate(preset.longitude, longitude)
  );
}

function formatCoordinatePreview(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

async function searchWeatherLocations(
  query: string,
  language: string,
  signal: AbortSignal
): Promise<WeatherLocationSearchItem[]> {
  const params = new URLSearchParams({
    q: query,
    language,
  });
  const response = await fetch(`/api/geocode/search?${params.toString()}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error("Search failed");
  }
  const payload = (await response.json()) as {
    results?: WeatherLocationSearchItem[];
  };
  if (!Array.isArray(payload.results)) return [];
  return payload.results.filter(
    (item) =>
      typeof item?.label === "string" &&
      typeof item?.latitude === "number" &&
      typeof item?.longitude === "number"
  );
}

export function WeatherLocationDialog({
  open,
  onOpenChange,
  disableSave = false,
  location,
  locationSource,
  setLocationByCoordinates,
  refreshCurrentLocation,
}: WeatherLocationDialogProps) {
  const { t, language } = useI18n();
  const wasOpenRef = useRef(false);

  const [selectedLocationOption, setSelectedLocationOption] =
    useState<string>(LOCATION_OPTION_SEARCH);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WeatherLocationSearchItem[]>(
    []
  );
  const [selectedSearchResult, setSelectedSearchResult] =
    useState<WeatherLocationSearchItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locationActionError, setLocationActionError] = useState<string | null>(
    null
  );
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const preset = findPresetByCoordinates(location.latitude, location.longitude);
      let nextSelectedOption = LOCATION_OPTION_SEARCH;
      if (locationSource === "current") {
        nextSelectedOption = LOCATION_OPTION_CURRENT;
      } else if (locationSource === "preset" && preset) {
        nextSelectedOption = preset.id;
      }
      setSelectedLocationOption(nextSelectedOption);
      setSearchQuery(location.label);
      setSelectedSearchResult({
        label: location.label,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setSearchResults([]);
      setIsSearching(false);
      setLocationActionError(null);
    }
    if (!open) {
      setLocationActionError(null);
      setSearchResults([]);
      setIsSearching(false);
    }
    wasOpenRef.current = open;
  }, [location.latitude, location.label, location.longitude, locationSource, open]);

  useEffect(() => {
    if (!open) return;
    if (selectedLocationOption !== LOCATION_OPTION_SEARCH) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setIsSearching(true);
          const results = await searchWeatherLocations(
            query,
            language,
            controller.signal
          );
          if (!controller.signal.aborted) {
            setSearchResults(results);
          }
        } catch {
          if (!controller.signal.aborted) {
            setSearchResults([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [open, language, searchQuery, selectedLocationOption]);

  const selectedPreset = useMemo(
    () =>
      WEATHER_LOCATION_PRESETS.find((item) => item.id === selectedLocationOption) ??
      null,
    [selectedLocationOption]
  );

  const handleSaveLocationSelection = async () => {
    setLocationActionError(null);
    setIsUpdatingLocation(true);
    try {
      if (selectedLocationOption === LOCATION_OPTION_CURRENT) {
        const updated = await refreshCurrentLocation();
        if (!updated) {
          setLocationActionError(
            t(
              "현재 위치를 가져오지 못했어요. 브라우저 위치 권한을 확인해 주세요.",
              "Couldn't get current location. Check browser location permission."
            )
          );
          return;
        }
      } else if (selectedLocationOption === LOCATION_OPTION_SEARCH) {
        if (!selectedSearchResult) {
          setLocationActionError(
            t("검색 결과에서 위치를 선택해 주세요.", "Select a location from search results.")
          );
          return;
        }
        await setLocationByCoordinates(selectedSearchResult, "search");
      } else {
        const preset = WEATHER_LOCATION_PRESETS.find(
          (item) => item.id === selectedLocationOption
        );
        if (!preset) {
          setLocationActionError(
            t("위치를 선택해 주세요.", "Please select a location.")
          );
          return;
        }
        await setLocationByCoordinates({
          latitude: preset.latitude,
          longitude: preset.longitude,
          label: t(preset.label.ko, preset.label.en),
        }, "preset");
      }
      onOpenChange(false);
    } catch {
      setLocationActionError(
        t("위치를 저장하지 못했어요.", "Failed to save location.")
      );
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const isSaveDisabled =
    disableSave ||
    isUpdatingLocation ||
    (selectedLocationOption === LOCATION_OPTION_SEARCH &&
      selectedSearchResult === null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("위치 설정", "Set location")}</DialogTitle>
          <DialogDescription>
            {t(
              "기본 지역을 선택하거나 검색으로 원하는 위치를 지정할 수 있어요.",
              "Choose from preset regions or search for a custom location."
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveLocationSelection();
          }}
        >
          <div className="space-y-1">
            <label className="text-xs text-gray-500">
              {t("위치 선택", "Location")}
            </label>
            <select
              className="w-full rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
              value={selectedLocationOption}
              onChange={(event) => {
                const next = event.target.value;
                setSelectedLocationOption(next);
                setLocationActionError(null);
                if (next !== LOCATION_OPTION_SEARCH) {
                  setSearchResults([]);
                  setIsSearching(false);
                }
              }}
            >
              <option value={LOCATION_OPTION_CURRENT}>
                {t("현재 위치", "Current location")}
              </option>
              {WEATHER_LOCATION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(preset.label.ko, preset.label.en)}
                </option>
              ))}
              <option value={LOCATION_OPTION_SEARCH}>
                {t("직접 검색", "Search manually")}
              </option>
            </select>
          </div>

          {selectedLocationOption === LOCATION_OPTION_SEARCH ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">
                  {t("지역 검색", "Search place")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSelectedSearchResult(null);
                    setLocationActionError(null);
                  }}
                  placeholder={t(
                    "예: 서울 강남, 부산 해운대",
                    "e.g. Gangnam Seoul, Haeundae Busan"
                  )}
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                {isSearching ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    {t("검색 중...", "Searching...")}
                  </div>
                ) : searchQuery.trim().length < 2 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    {t("두 글자 이상 입력해 주세요.", "Enter at least 2 characters.")}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    {t("검색 결과가 없어요.", "No results found.")}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchResults.map((item) => {
                      const isSelected =
                        selectedSearchResult?.label === item.label &&
                        selectedSearchResult?.latitude === item.latitude &&
                        selectedSearchResult?.longitude === item.longitude;
                      return (
                        <button
                          key={`${item.label}:${item.latitude}:${item.longitude}`}
                          type="button"
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800/40",
                            isSelected ? "bg-primary/10 text-primary" : ""
                          )}
                          onClick={() => {
                            setSelectedSearchResult(item);
                            setLocationActionError(null);
                          }}
                        >
                          <div className="truncate font-medium">{item.label}</div>
                          <div className="text-xs text-gray-500">
                            {formatCoordinatePreview(item.latitude, item.longitude)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {selectedPreset ? (
            <div className="rounded-md border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/30">
              <div className="font-medium text-gray-700 dark:text-gray-200">
                {t(selectedPreset.label.ko, selectedPreset.label.en)}
              </div>
              <div>
                {formatCoordinatePreview(
                  selectedPreset.latitude,
                  selectedPreset.longitude
                )}
              </div>
            </div>
          ) : null}

          {selectedLocationOption === LOCATION_OPTION_SEARCH &&
          selectedSearchResult ? (
            <div className="rounded-md border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/30">
              <div className="font-medium text-gray-700 dark:text-gray-200">
                {selectedSearchResult.label}
              </div>
              <div>
                {formatCoordinatePreview(
                  selectedSearchResult.latitude,
                  selectedSearchResult.longitude
                )}
              </div>
            </div>
          ) : null}

          <div className="text-xs text-gray-500">
            {t(
              "여기서 설정한 위치는 앱 전체(날씨 위젯/달력 날씨)에 공통 적용돼요.",
              "This location applies globally across the app (Weather widget and Calendar weather)."
            )}
          </div>

          {locationActionError ? (
            <div className="text-sm text-red-500">{locationActionError}</div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("취소", "Cancel")}
            </Button>
            <Button type="submit" disabled={isSaveDisabled}>
              {t("저장", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
