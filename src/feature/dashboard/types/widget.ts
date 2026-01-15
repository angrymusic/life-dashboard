import type { WidgetType } from "@/shared/db/schema";

export type WidgetOption = {
  type: WidgetType;
  title: string;
  description: string;
};
