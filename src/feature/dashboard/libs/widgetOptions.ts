import type { WidgetOption } from "@/feature/dashboard/types/widget";

export const widgetOptions: WidgetOption[] = [
  {
    type: "calendar",
    title: "달력",
    description: "월간 일정과 이벤트를 확인해요",
  },
  {
    type: "memo",
    title: "메모",
    description: "간단한 메모를 적어요",
  },
  {
    type: "photo",
    title: "사진",
    description: "사진을 올려요",
  },
  {
    type: "todo",
    title: "할 일",
    description: "오늘 할 일을 체크해요",
  },
  {
    type: "dday",
    title: "디데이",
    description: "목표일까지 남은 날짜를 확인해요",
  },
  {
    type: "mood",
    title: "기분",
    description: "현재 기분을 골라요",
  },
  {
    type: "chart",
    title: "차트",
    description: "목표 진행을 시간 순으로 기록해요",
  },
  {
    type: "weather",
    title: "날씨",
    description: "이번 주 날씨를 확인해요",
  },
];
