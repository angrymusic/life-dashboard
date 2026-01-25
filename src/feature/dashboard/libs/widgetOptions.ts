import type { WidgetOption } from "@/feature/dashboard/types/widget";

export const widgetOptions: WidgetOption[] = [
  {
    type: "calendar",
    title: "Calendar",
    description: "월간 일정과 이벤트를 확인해요",
  },
  {
    type: "memo",
    title: "Memo",
    description: "간단한 메모를 적어요",
  },
  {
    type: "todo",
    title: "Todo",
    description: "오늘 할 일을 체크해요",
  },
  {
    type: "weather",
    title: "Weather",
    description: "이번 주 날씨를 확인해요",
  },
];
