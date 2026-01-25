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

type WeatherIconProps = {
  code?: number | null;
  className?: string;
};

function getWeatherCondition(code?: number | null): {
  Icon: LucideIcon;
  label: string;
} {
  if (code === 0) return { Icon: Sun, label: "맑음" };
  if (code === 1 || code === 2) return { Icon: CloudSun, label: "구름 조금" };
  if (code === 3) return { Icon: Cloud, label: "흐림" };
  if (code === 45 || code === 48) return { Icon: Cloud, label: "안개" };
  if (code !== null && code !== undefined) {
    if (code >= 51 && code <= 67) return { Icon: CloudRain, label: "비" };
    if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: "눈" };
    if (code >= 80 && code <= 82) return { Icon: CloudRain, label: "소나기" };
    if (code >= 85 && code <= 86) return { Icon: CloudSnow, label: "눈" };
    if (code >= 95 && code <= 99)
      return { Icon: CloudLightning, label: "천둥번개" };
  }
  return { Icon: Cloud, label: "구름" };
}

export function WeatherIcon({ code, className }: WeatherIconProps) {
  const { Icon, label } = getWeatherCondition(code);
  return (
    <Icon
      className={cn("text-gray-500", className)}
      aria-label={label}
    />
  );
}
