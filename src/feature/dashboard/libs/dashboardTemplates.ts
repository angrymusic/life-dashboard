import type {
  Mood,
  WidgetLayout,
  WidgetType,
  YMD,
} from "@/shared/db/schema";
import type { AppLanguage } from "@/shared/i18n/language";

export type LocalizedText = {
  ko: string;
  en: string;
};

type TemplateTodoSeed = {
  title: LocalizedText;
  done?: boolean;
};

type TemplateCalendarSeed = {
  title: LocalizedText;
  offsetDays: number;
  startHour?: number;
  startMinute?: number;
  durationMinutes?: number;
  allDay?: boolean;
  location?: LocalizedText;
  description?: LocalizedText;
  color?: string;
};

type TemplateDdaySeed = {
  title: LocalizedText;
  offsetDays: number;
  color?: string;
};

type TemplateChartSeed = {
  name: LocalizedText;
  unit?: LocalizedText;
  chartType?: "line" | "bar";
  entries: Array<{
    dateOffsetDays: number;
    value: number;
  }>;
};

type TemplateMemoSeed = {
  text: LocalizedText;
  color?: string;
};

type TemplateMoodSeed = {
  mood: Mood["mood"];
  note?: LocalizedText;
};

type TemplateWidget = {
  type: WidgetType;
  title: LocalizedText;
  description: LocalizedText;
  layout: WidgetLayout;
};

export type DashboardTemplateSlug =
  | "family-dashboard"
  | "personal-dashboard"
  | "couple-dashboard";

export type DashboardTemplate = {
  slug: DashboardTemplateSlug;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  name: LocalizedText;
  eyebrow: LocalizedText;
  headline: LocalizedText;
  summary: LocalizedText;
  audience: LocalizedText;
  dashboardName: LocalizedText;
  useCases: LocalizedText[];
  widgets: TemplateWidget[];
  memo?: TemplateMemoSeed;
  todos?: TemplateTodoSeed[];
  calendarEvents?: TemplateCalendarSeed[];
  dday?: TemplateDdaySeed;
  chart?: TemplateChartSeed;
  mood?: TemplateMoodSeed;
};

export const dashboardTemplates: DashboardTemplate[] = [
  {
    slug: "family-dashboard",
    metaTitle: "Family Dashboard Template for Shared Schedules and Chores",
    metaDescription:
      "Use a family dashboard template with calendar, chores, notes, countdowns, and weekly budget tracking.",
    metaKeywords: [
      "family dashboard template",
      "family planner dashboard",
      "shared family calendar",
      "family chores dashboard",
    ],
    name: {
      ko: "가족 대시보드",
      en: "Family Dashboard",
    },
    eyebrow: {
      ko: "가족용 템플릿",
      en: "Family template",
    },
    headline: {
      ko: "가족 일정과 집안 루틴을 한 화면에서 관리하세요",
      en: "Manage family schedules and household routines in one view",
    },
    summary: {
      ko: "학교 일정, 장보기 메모, 해야 할 일, 여행 카운트다운까지 함께 보는 시작 화면입니다.",
      en: "Start with a shared view for school events, grocery notes, chores, and a family countdown.",
    },
    audience: {
      ko: "아이 일정과 집안 할 일을 같이 보는 가족에게 잘 맞습니다.",
      en: "Best for families who want one place for school events, errands, and household planning.",
    },
    dashboardName: {
      ko: "가족 대시보드",
      en: "Family Dashboard",
    },
    useCases: [
      {
        ko: "오늘 챙겨야 할 일정과 집안 할 일을 바로 확인할 수 있어요.",
        en: "See today's events and household tasks at a glance.",
      },
      {
        ko: "장보기나 공용 메모를 한곳에 남겨 가족이 같이 확인할 수 있어요.",
        en: "Keep shared notes and grocery reminders in one place.",
      },
      {
        ko: "다가오는 여행이나 중요한 날짜를 함께 카운트다운할 수 있어요.",
        en: "Track upcoming trips and milestone dates together.",
      },
    ],
    widgets: [
      {
        type: "calendar",
        title: {
          ko: "가족 캘린더",
          en: "Family calendar",
        },
        description: {
          ko: "학교 일정, 레슨, 주말 계획을 한 달 단위로 확인합니다.",
          en: "Track school events, lessons, and weekend plans in one calendar.",
        },
        layout: {
          x: 0,
          y: 0,
          w: 7,
          h: 16,
          minW: 4,
          minH: 12,
        },
      },
      {
        type: "todo",
        title: {
          ko: "오늘 할 일",
          en: "Today's tasks",
        },
        description: {
          ko: "장보기, 준비물, 집안일처럼 바로 처리할 일을 정리합니다.",
          en: "List errands, supplies, and chores that need attention today.",
        },
        layout: {
          x: 7,
          y: 0,
          w: 5,
          h: 10,
          minW: 2,
          minH: 6,
        },
      },
      {
        type: "memo",
        title: {
          ko: "가족 메모",
          en: "Family memo",
        },
        description: {
          ko: "이번 주 꼭 챙길 공용 메모를 남깁니다.",
          en: "Keep a shared note for the week ahead.",
        },
        layout: {
          x: 7,
          y: 6,
          w: 5,
          h: 6,
          minW: 2,
          minH: 4,
        },
      },
      {
        type: "dday",
        title: {
          ko: "가족 디데이",
          en: "Family countdown",
        },
        description: {
          ko: "가족 여행이나 중요한 날까지 남은 시간을 보여줍니다.",
          en: "Count down to a trip or important family date.",
        },
        layout: {
          x: 0,
          y: 13,
          w: 4,
          h: 8,
          minW: 2,
          minH: 6,
        },
      },
      {
        type: "chart",
        title: {
          ko: "주간 생활비 차트",
          en: "Weekly budget chart",
        },
        description: {
          ko: "생활비 흐름처럼 숫자로 보는 루틴도 함께 관리합니다.",
          en: "Track weekly budget flow with a ready-made chart.",
        },
        layout: {
          x: 4,
          y: 13,
          w: 8,
          h: 8,
          minW: 4,
          minH: 8,
        },
      },
    ],
    memo: {
      text: {
        ko: "이번 주 체크\n- 금요일 체육복 챙기기\n- 우유와 과일 주문\n- 토요일 공원 소풍 도시락 준비",
        en: "This week\n- Pack gym clothes on Friday\n- Order milk and fruit\n- Prep lunch for Saturday park picnic",
      },
    },
    todos: [
      {
        title: {
          ko: "냉장고 재료 확인하고 장보기 목록 정리",
          en: "Check the fridge and update the grocery list",
        },
      },
      {
        title: {
          ko: "아이 준비물 가방에 넣기",
          en: "Pack school supplies",
        },
        done: true,
      },
      {
        title: {
          ko: "분리수거 내놓기",
          en: "Put out recycling",
        },
      },
    ],
    calendarEvents: [
      {
        title: {
          ko: "하교 후 픽업",
          en: "School pickup",
        },
        offsetDays: 0,
        startHour: 15,
        startMinute: 30,
        durationMinutes: 45,
        location: {
          ko: "정문 앞",
          en: "Front gate",
        },
        color: "#2563eb",
      },
      {
        title: {
          ko: "피아노 레슨",
          en: "Piano lesson",
        },
        offsetDays: 1,
        startHour: 17,
        durationMinutes: 60,
        location: {
          ko: "음악 학원",
          en: "Music academy",
        },
        color: "#8b5cf6",
      },
      {
        title: {
          ko: "가족 공원 나들이",
          en: "Family park day",
        },
        offsetDays: 5,
        allDay: true,
        color: "#16a34a",
      },
    ],
    dday: {
      title: {
        ko: "봄 가족여행",
        en: "Spring family trip",
      },
      offsetDays: 18,
    },
    chart: {
      name: {
        ko: "주간 생활비",
        en: "Weekly budget",
      },
      unit: {
        ko: "만원",
        en: "$100",
      },
      chartType: "bar",
      entries: [
        { dateOffsetDays: -21, value: 18 },
        { dateOffsetDays: -14, value: 12 },
        { dateOffsetDays: -7, value: 10 },
        { dateOffsetDays: 0, value: 16 },
      ],
    },
  },
  {
    slug: "personal-dashboard",
    metaTitle: "Personal Dashboard Template for Tasks, Notes, and Routines",
    metaDescription:
      "Start a personal dashboard with tasks, notes, calendar events, mood logging, and a progress chart.",
    metaKeywords: [
      "personal dashboard template",
      "personal planner dashboard",
      "productivity dashboard",
      "routine dashboard",
    ],
    name: {
      ko: "개인 대시보드",
      en: "Personal Dashboard",
    },
    eyebrow: {
      ko: "개인용 템플릿",
      en: "Personal template",
    },
    headline: {
      ko: "나만의 일정, 집중 시간, 메모를 빠르게 정리하세요",
      en: "Organize your schedule, focus time, and notes in one place",
    },
    summary: {
      ko: "오늘 할 일과 캘린더, 루틴 차트, 메모를 바로 사용할 수 있는 개인 시작 화면입니다.",
      en: "Get a ready-to-use personal setup with tasks, calendar, chart, mood, and notes.",
    },
    audience: {
      ko: "할 일과 루틴을 같이 관리하고 싶은 1인 사용자에게 적합합니다.",
      en: "Best for solo users who want tasks, routines, and planning in one dashboard.",
    },
    dashboardName: {
      ko: "개인 대시보드",
      en: "Personal Dashboard",
    },
    useCases: [
      {
        ko: "오늘 해야 할 일과 이번 주 일정을 바로 정리할 수 있어요.",
        en: "Plan today's tasks and this week's events quickly.",
      },
      {
        ko: "운동 시간이나 공부 시간 같은 개인 지표를 차트로 볼 수 있어요.",
        en: "Track personal metrics like workout or study time with a chart.",
      },
      {
        ko: "기분 기록과 메모를 함께 남겨 하루 흐름을 돌아볼 수 있어요.",
        en: "Capture your mood and notes to reflect on the day.",
      },
    ],
    widgets: [
      {
        type: "todo",
        title: {
          ko: "오늘 할 일",
          en: "Today's tasks",
        },
        description: {
          ko: "오늘 처리할 핵심 작업을 빠르게 정리합니다.",
          en: "Keep your top priorities for the day visible.",
        },
        layout: {
          x: 0,
          y: 0,
          w: 4,
          h: 8,
          minW: 2,
          minH: 6,
        },
      },
      {
        type: "memo",
        title: {
          ko: "집중 메모",
          en: "Focus note",
        },
        description: {
          ko: "이번 주 집중할 포인트를 적어 둡니다.",
          en: "Write down the focus points for the week.",
        },
        layout: {
          x: 4,
          y: 0,
          w: 4,
          h: 8,
          minW: 2,
          minH: 4,
        },
      },
      {
        type: "mood",
        title: {
          ko: "오늘의 기분",
          en: "Today's mood",
        },
        description: {
          ko: "하루 컨디션을 빠르게 기록합니다.",
          en: "Log how today feels with one tap.",
        },
        layout: {
          x: 8,
          y: 0,
          w: 4,
          h: 8,
          minW: 2,
          minH: 5,
        },
      },
      {
        type: "calendar",
        title: {
          ko: "개인 캘린더",
          en: "Personal calendar",
        },
        description: {
          ko: "집중 시간, 운동, 약속을 한 달 단위로 확인합니다.",
          en: "View focus sessions, workouts, and appointments on a monthly calendar.",
        },
        layout: {
          x: 0,
          y: 6,
          w: 7,
          h: 16,
          minW: 4,
          minH: 12,
        },
      },
      {
        type: "chart",
        title: {
          ko: "루틴 차트",
          en: "Routine chart",
        },
        description: {
          ko: "최근 며칠간의 루틴 수치를 바로 확인합니다.",
          en: "Track a recent routine metric with a ready-made chart.",
        },
        layout: {
          x: 7,
          y: 5,
          w: 5,
          h: 10,
          minW: 4,
          minH: 8,
        },
      },
    ],
    memo: {
      text: {
        ko: "이번 주 집중 포인트\n- 오전 9시 전 메시지 확인 최소화\n- 운동 3회 채우기\n- 금요일까지 사이드 프로젝트 초안 완성",
        en: "Focus this week\n- Avoid checking messages before 9 AM\n- Finish 3 workouts\n- Draft the side project by Friday",
      },
    },
    todos: [
      {
        title: {
          ko: "오전 집중 블록 2시간 확보",
          en: "Protect a 2-hour focus block this morning",
        },
      },
      {
        title: {
          ko: "운동 가방 챙기기",
          en: "Pack the gym bag",
        },
      },
      {
        title: {
          ko: "읽을 문서 1개 끝내기",
          en: "Finish one reading document",
        },
        done: true,
      },
    ],
    calendarEvents: [
      {
        title: {
          ko: "집중 작업 세션",
          en: "Deep work session",
        },
        offsetDays: 0,
        startHour: 10,
        durationMinutes: 120,
        color: "#2563eb",
      },
      {
        title: {
          ko: "헬스장",
          en: "Gym",
        },
        offsetDays: 1,
        startHour: 7,
        durationMinutes: 75,
        color: "#16a34a",
      },
      {
        title: {
          ko: "친구와 점심 약속",
          en: "Lunch with a friend",
        },
        offsetDays: 3,
        startHour: 12,
        durationMinutes: 90,
        color: "#f59e0b",
      },
    ],
    chart: {
      name: {
        ko: "운동 시간",
        en: "Workout minutes",
      },
      unit: {
        ko: "분",
        en: "min",
      },
      chartType: "line",
      entries: [
        { dateOffsetDays: -4, value: 30 },
        { dateOffsetDays: -3, value: 0 },
        { dateOffsetDays: -2, value: 45 },
        { dateOffsetDays: -1, value: 20 },
        { dateOffsetDays: 0, value: 40 },
      ],
    },
    mood: {
      mood: "good",
      note: {
        ko: "루틴이 잘 유지되는 날",
        en: "A day when the routine feels steady",
      },
    },
  },
  {
    slug: "couple-dashboard",
    metaTitle: "Couple Dashboard Template for Shared Plans and Countdowns",
    metaDescription:
      "Launch a couple dashboard with shared dates, errands, notes, and an anniversary countdown.",
    metaKeywords: [
      "couple dashboard template",
      "shared couple calendar",
      "couple planner dashboard",
      "anniversary countdown dashboard",
    ],
    name: {
      ko: "커플 대시보드",
      en: "Couple Dashboard",
    },
    eyebrow: {
      ko: "커플용 템플릿",
      en: "Couple template",
    },
    headline: {
      ko: "둘의 일정과 준비할 일을 가볍게 같이 관리하세요",
      en: "Manage shared plans and prep together with a simple couple dashboard",
    },
    summary: {
      ko: "데이트 일정, 공동 할 일, 여행 메모, 기념일 카운트다운을 담은 템플릿입니다.",
      en: "Start with shared dates, errands, trip notes, and an anniversary countdown.",
    },
    audience: {
      ko: "데이트 일정이나 공동 준비물을 함께 챙기고 싶은 커플에게 적합합니다.",
      en: "Best for couples who want a shared place for plans, errands, and countdowns.",
    },
    dashboardName: {
      ko: "커플 대시보드",
      en: "Couple Dashboard",
    },
    useCases: [
      {
        ko: "데이트 일정과 공용 준비물을 같은 화면에서 확인할 수 있어요.",
        en: "See date plans and shared prep tasks in one place.",
      },
      {
        ko: "여행이나 기념일까지 남은 시간을 함께 세어 볼 수 있어요.",
        en: "Count down to trips and anniversaries together.",
      },
      {
        ko: "공동 메모를 남겨 둘 다 같은 정보를 볼 수 있어요.",
        en: "Keep one shared note so both people stay aligned.",
      },
    ],
    widgets: [
      {
        type: "calendar",
        title: {
          ko: "함께 보는 캘린더",
          en: "Shared calendar",
        },
        description: {
          ko: "데이트와 약속을 한 달 단위로 확인합니다.",
          en: "Track date nights and shared plans in a monthly view.",
        },
        layout: {
          x: 0,
          y: 0,
          w: 7,
          h: 16,
          minW: 4,
          minH: 12,
        },
      },
      {
        type: "dday",
        title: {
          ko: "기념일 디데이",
          en: "Anniversary countdown",
        },
        description: {
          ko: "다가오는 중요한 날을 바로 보여줍니다.",
          en: "Keep the next milestone visible on the dashboard.",
        },
        layout: {
          x: 7,
          y: 0,
          w: 5,
          h: 6,
          minW: 2,
          minH: 6,
        },
      },
      {
        type: "memo",
        title: {
          ko: "공용 메모",
          en: "Shared memo",
        },
        description: {
          ko: "여행 준비나 선물 아이디어를 함께 적습니다.",
          en: "Write down trip prep or gift ideas together.",
        },
        layout: {
          x: 7,
          y: 6,
          w: 5,
          h: 8,
          minW: 2,
          minH: 4,
        },
      },
      {
        type: "todo",
        title: {
          ko: "공동 할 일",
          en: "Shared tasks",
        },
        description: {
          ko: "같이 준비해야 할 일을 빠르게 정리합니다.",
          en: "Track errands and prep tasks for both people.",
        },
        layout: {
          x: 7,
          y: 10,
          w: 5,
          h: 8,
          minW: 2,
          minH: 6,
        },
      },
    ],
    memo: {
      text: {
        ko: "이번 주 메모\n- 금요일 저녁 식당 예약 확인\n- 제주 여행 숙소 후보 2곳 비교\n- 기념일 선물 아이디어 정리",
        en: "This week\n- Confirm Friday dinner reservation\n- Compare two Jeju stay options\n- Collect anniversary gift ideas",
      },
    },
    todos: [
      {
        title: {
          ko: "주말 장보기 같이 하기",
          en: "Do the weekend grocery run together",
        },
      },
      {
        title: {
          ko: "식당 예약 시간 공유하기",
          en: "Share the dinner reservation time",
        },
      },
      {
        title: {
          ko: "기차표 예매 완료",
          en: "Finish booking train tickets",
        },
        done: true,
      },
    ],
    calendarEvents: [
      {
        title: {
          ko: "저녁 데이트",
          en: "Dinner date",
        },
        offsetDays: 2,
        startHour: 19,
        durationMinutes: 120,
        location: {
          ko: "예약 레스토랑",
          en: "Reserved restaurant",
        },
        color: "#ec4899",
      },
      {
        title: {
          ko: "영화 보기",
          en: "Movie night",
        },
        offsetDays: 4,
        startHour: 20,
        durationMinutes: 150,
        color: "#8b5cf6",
      },
      {
        title: {
          ko: "주말 드라이브",
          en: "Weekend drive",
        },
        offsetDays: 6,
        allDay: true,
        color: "#16a34a",
      },
    ],
    dday: {
      title: {
        ko: "기념일 여행",
        en: "Anniversary getaway",
      },
      offsetDays: 42,
    },
  },
];

export function getDashboardTemplate(slug: string) {
  return dashboardTemplates.find((template) => template.slug === slug) ?? null;
}

export function getLocalizedText(
  text: LocalizedText,
  language: AppLanguage
) {
  return language === "ko" ? text.ko : text.en;
}

export function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}` as YMD;
}
