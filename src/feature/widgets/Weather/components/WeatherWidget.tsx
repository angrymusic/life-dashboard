import { useMemo, useState } from "react";
import { LocateFixed, MapPin, RefreshCcw } from "lucide-react";
import type { Id, YMD } from "@/shared/db/schema";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { WeatherIcon } from "@/feature/widgets/Weather/components/WeatherIcon";
import { WeatherLocationDialog } from "@/feature/widgets/Weather/components/WeatherLocationDialog";
import { useWeatherForecast } from "@/feature/widgets/Weather/hooks/useWeatherForecast";
import { useWeatherLocation } from "@/feature/widgets/Weather/hooks/useWeatherLocation";
import { useI18n } from "@/shared/i18n/client";
import { cn } from "@/shared/lib/utils";
import type { WeatherHourly } from "@/feature/widgets/Weather/libs/openMeteo";

function formatDayLabel(
  ymd: YMD,
  index: number,
  locale: string,
  t: (ko: string, en: string) => string
) {
  if (index === 0) return t("오늘", "Today");
  if (index === 1) return t("내일", "Tomorrow");
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
}

function formatTemp(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}°`;
}

function formatUpdatedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toYmd(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

function formatHourLabel(hour: number | null, locale: string) {
  if (hour === null) return "--";
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
  }).format(date);
}

type WeatherWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function WeatherWidget({ widgetId, canEdit = true }: WeatherWidgetProps) {
  const { t, locale } = useI18n();
  const { location, refreshCurrentLocation } = useWeatherLocation();
  const { forecast, isLoading, error, refresh } = useWeatherForecast(widgetId, {
    location,
  });
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [locationActionError, setLocationActionError] = useState<string | null>(
    null
  );
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const openLocationDialog = () => {
    setLocationActionError(null);
    setIsLocationDialogOpen(true);
  };

  const handleRefreshCurrentLocation = async () => {
    setLocationActionError(null);
    setIsUpdatingLocation(true);
    try {
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
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const {
    actions,
    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      close: closeDeleteDialog,
      confirm: handleDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit,
    deleteLabel: t("위젯 삭제", "Delete widget"),
    extraItems: [
      {
        text: t("새로고침", "Refresh"),
        icon: <RefreshCcw className="size-4" />,
        disabled: isLoading || isUpdatingLocation,
        onClick: refresh,
      },
      {
        text: t("현재 위치로 갱신", "Use current location"),
        icon: <LocateFixed className="size-4" />,
        disabled: isLoading || isUpdatingLocation,
        onClick: () => void handleRefreshCurrentLocation(),
      },
      {
        text: t("위치 설정", "Set location"),
        icon: <MapPin className="size-4" />,
        disabled: isLoading || isUpdatingLocation,
        onClick: openLocationDialog,
      },
    ],
  });

  const days = useMemo(() => forecast?.days ?? [], [forecast?.days]);
  const now = new Date();
  const todayYmd = toYmd(now);
  const currentHour = now.getHours();
  const hourlyToday = useMemo<WeatherHourly[]>(() => {
    const hourly = forecast?.hourly ?? [];
    return hourly.filter(
      (item) => item.ymd === todayYmd && (item.hour ?? -1) >= currentHour
    );
  }, [forecast?.hourly, todayYmd, currentHour]);
  const currentEntry = useMemo(() => {
    if (hourlyToday.length === 0) return null;
    const exact = hourlyToday.find((item) => item.hour === currentHour);
    return exact ?? hourlyToday[0] ?? null;
  }, [hourlyToday, currentHour]);
  const todayRange = useMemo(() => {
    if (!days[0]) return null;
    return `${formatTemp(days[0].tempMin)} / ${formatTemp(days[0].tempMax)}`;
  }, [days]);
  const updatedAt = forecast?.fetchedAt
    ? formatUpdatedAt(forecast.fetchedAt, locale)
    : "";
  const tempRangeByDay = useMemo(
    () =>
      days.map((day, index) => ({
        label: formatDayLabel(day.ymd, index, locale, t),
        tempRange: `${formatTemp(day.tempMin)} / ${formatTemp(day.tempMax)}`,
      })),
    [days, locale, t]
  );

  return (
    <WidgetCard
      header={
        <WidgetHeader title={t("날씨", "Weather")} actions={actions} canEdit={canEdit} />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="min-w-0 truncate">{location.label}</span>
          {updatedAt ? (
            <span className="hidden @xs:inline">
              {t("업데이트", "Updated")} {updatedAt}
            </span>
          ) : null}
        </div>

        {currentEntry ? (
          <div className="mt-3 rounded-lg border border-gray-200/70 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">{t("현재", "Now")}</div>
                <div className="text-3xl font-semibold leading-none">
                  {formatTemp(currentEntry.temp)}
                </div>
                {todayRange ? (
                  <div className="mt-1 text-xs text-gray-500">
                    {t("최저/최고", "Low/High")} {todayRange}
                  </div>
                ) : null}
              </div>
              <WeatherIcon
                code={currentEntry.weatherCode}
                className="size-10"
              />
            </div>
          </div>
        ) : null}

        <div
          className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 touch-pan-y overscroll-y-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {!forecast && isLoading ? (
            <div className="text-sm text-gray-400">
              {t("날씨 불러오는 중...", "Loading weather...")}
            </div>
          ) : null}
          {error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : null}
          {locationActionError && !isLocationDialogOpen ? (
            <div className="text-sm text-red-500">{locationActionError}</div>
          ) : null}
          {forecast ? (
            <div className="mb-3 min-w-0">
              <div className="mb-2 text-xs text-gray-500">{t("이번 주", "This week")}</div>
              <div
                className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 touch-pan-x overscroll-x-contain"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {days.map((day, index) => (
                  <div
                    key={day.ymd}
                    className="flex min-w-[100px] shrink-0 items-center justify-between rounded-md border border-gray-200/70 dark:border-gray-700 px-2 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 font-medium">
                        {tempRangeByDay[index]?.label ?? "-"}
                      </span>
                      <WeatherIcon code={day.weatherCode} className="size-4" />
                    </div>
                    <span className="text-gray-500">
                      {tempRangeByDay[index]?.tempRange ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {hourlyToday.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">{t("오늘 시간별", "Today by hour")}</div>
              <div className="space-y-2">
                {hourlyToday.map((hour) => (
                  <div
                    key={hour.time}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-[12px]",
                      hour.hour === currentHour
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-gray-200/70 dark:border-gray-700 text-gray-500"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 font-medium">
                        {formatHourLabel(hour.hour, locale)}
                      </span>
                      <WeatherIcon
                        code={hour.weatherCode}
                        className="size-4"
                      />
                    </div>
                    <span className="text-sm">{formatTemp(hour.temp)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName={t("날씨", "Weather")}
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}

        <WeatherLocationDialog
          open={isLocationDialogOpen}
          onOpenChange={(nextOpen) => {
            setIsLocationDialogOpen(nextOpen);
            if (!nextOpen) setLocationActionError(null);
          }}
          disableSave={isLoading || isUpdatingLocation}
        />
      </div>
    </WidgetCard>
  );
}
