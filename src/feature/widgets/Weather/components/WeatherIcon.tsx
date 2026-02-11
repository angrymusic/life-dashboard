import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useI18n } from "@/shared/i18n/client";

type WeatherIconProps = {
  code?: number | null;
  className?: string;
};

function getWeatherCondition(
  code: number | null | undefined,
  t: (ko: string, en: string) => string
): {
  Icon: LucideIcon;
  label: string;
} {
  if (code === 0) return { Icon: Sun, label: t("맑음", "Clear") };
  if (code === 1 || code === 2) return { Icon: CloudSun, label: t("구름 조금", "Partly cloudy") };
  if (code === 3) return { Icon: Cloud, label: t("흐림", "Cloudy") };
  if (code === 45 || code === 48) return { Icon: Cloud, label: t("안개", "Fog") };
  if (code !== null && code !== undefined) {
    if (code >= 51 && code <= 67) return { Icon: CloudRain, label: t("비", "Rain") };
    if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: t("눈", "Snow") };
    if (code >= 80 && code <= 82) return { Icon: CloudRain, label: t("소나기", "Shower") };
    if (code >= 85 && code <= 86) return { Icon: CloudSnow, label: t("눈", "Snow") };
    if (code >= 95 && code <= 99)
      return { Icon: CloudLightning, label: t("천둥번개", "Thunderstorm") };
  }
  return { Icon: Cloud, label: t("구름", "Cloud") };
}

export function WeatherIcon({ code, className }: WeatherIconProps) {
  const { t } = useI18n();
  const { Icon, label } = getWeatherCondition(code, t);
  return (
    <Icon
      className={cn("text-gray-500", className)}
      aria-label={label}
    />
  );
}
