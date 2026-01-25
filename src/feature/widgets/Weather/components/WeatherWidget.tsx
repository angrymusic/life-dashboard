import { useMemo } from "react";
import { RefreshCcw } from "lucide-react";
import type { Id, YMD } from "@/shared/db/schema";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { WeatherIcon } from "@/feature/widgets/Weather/components/WeatherIcon";
import { useWeatherForecast } from "@/feature/widgets/Weather/hooks/useWeatherForecast";
import { useWeatherLocation } from "@/feature/widgets/Weather/hooks/useWeatherLocation";
import { cn } from "@/shared/lib/utils";
import type { WeatherHourly } from "@/feature/widgets/Weather/libs/openMeteo";

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDayLabel(ymd: YMD, index: number) {
  if (index === 0) return "오늘";
  if (index === 1) return "내일";
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return ymd;
  return WEEK_DAYS[date.getDay()];
}

function formatTemp(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}°`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toYmd(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

function formatHourLabel(hour: number | null) {
  if (hour === null) return "--";
  return `${hour}시`;
}

type WeatherWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function WeatherWidget({ widgetId, canEdit = true }: WeatherWidgetProps) {
  const { location } = useWeatherLocation();
  const { forecast, isLoading, error, refresh } = useWeatherForecast(widgetId, {
    location,
  });
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
    deleteLabel: "위젯 삭제",
    extraItems: [
      {
        text: "새로고침",
        icon: <RefreshCcw className="size-4" />,
        disabled: isLoading,
        onClick: refresh,
      },
    ],
  });

  const days = useMemo(() => forecast?.days ?? [], [forecast?.days]);
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const hourlyToday = useMemo<WeatherHourly[]>(() => {
    const hourly = forecast?.hourly ?? [];
    const currentHourValue = new Date().getHours();
    return hourly.filter(
      (item) => item.ymd === todayYmd && (item.hour ?? -1) >= currentHourValue
    );
  }, [forecast?.hourly, todayYmd]);
  const currentHour = useMemo(() => new Date().getHours(), []);
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
    ? formatUpdatedAt(forecast.fetchedAt)
    : "";
  const tempRangeByDay = useMemo(
    () =>
      days.map((day, index) => ({
        label: formatDayLabel(day.ymd, index),
        tempRange: `${formatTemp(day.tempMin)} / ${formatTemp(day.tempMax)}`,
      })),
    [days]
  );

  return (
    <WidgetCard
      header={
        <WidgetHeader title="날씨" actions={actions} canEdit={canEdit} />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="min-w-0 truncate">{location.label}</span>
          {updatedAt ? (
            <span className="hidden @xs:inline">업데이트 {updatedAt}</span>
          ) : null}
        </div>

        {currentEntry ? (
          <div className="mt-3 rounded-lg border border-gray-200/70 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">현재</div>
                <div className="text-3xl font-semibold leading-none">
                  {formatTemp(currentEntry.temp)}
                </div>
                {todayRange ? (
                  <div className="mt-1 text-xs text-gray-500">
                    최저/최고 {todayRange}
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

        <div className="mt-3 flex-1 min-h-0 overflow-auto">
          {!forecast && isLoading ? (
            <div className="text-sm text-gray-400">날씨 불러오는 중...</div>
          ) : null}
          {error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : null}
          {forecast ? (
            <div className="mb-3">
              <div className="mb-2 text-xs text-gray-500">이번 주</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((day, index) => (
                  <div
                    key={day.ymd}
                    className="flex min-w-[100px] items-center justify-between rounded-md border border-gray-200/70 dark:border-gray-700 px-2 py-1.5 text-[11px]"
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
              <div className="text-xs text-gray-500">오늘 시간별</div>
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
                      <span className="w-10 font-medium">
                        {formatHourLabel(hour.hour)}
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
            widgetName="날씨"
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
