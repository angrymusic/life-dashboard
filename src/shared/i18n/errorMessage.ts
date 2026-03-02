export type TranslateFn = (ko: string, en: string) => string;

const MESSAGE_MAP: Record<string, { ko: string; en: string }> = {
  Unauthorized: {
    ko: "로그인이 필요해요.",
    en: "Unauthorized",
  },
  Forbidden: {
    ko: "권한이 없어요.",
    en: "Forbidden",
  },
  "Unknown error": {
    ko: "알 수 없는 오류가 발생했어요.",
    en: "Unknown error",
  },
  "Invalid JSON body": {
    ko: "요청 형식이 올바르지 않아요.",
    en: "Invalid JSON body",
  },
  "Invalid request body": {
    ko: "요청 형식이 올바르지 않아요.",
    en: "Invalid request body",
  },
  "Dashboard not found": {
    ko: "대시보드를 찾을 수 없어요.",
    en: "Dashboard not found",
  },
  "Dashboard is not shared": {
    ko: "공유 대시보드가 아니에요.",
    en: "Dashboard is not shared",
  },
  "Member not found": {
    ko: "구성원을 찾을 수 없어요.",
    en: "Member not found",
  },
  "User not found": {
    ko: "사용자를 찾을 수 없어요.",
    en: "User not found",
  },
  "Cannot add yourself": {
    ko: "본인은 구성원으로 추가할 수 없어요.",
    en: "Cannot add yourself",
  },
  "You cannot change the first creator's role.": {
    ko: "첫 생성자의 권한은 변경할 수 없어요.",
    en: "You cannot change the first creator's role.",
  },
  "Cannot remove yourself": {
    ko: "본인은 퇴출할 수 없어요.",
    en: "Cannot remove yourself",
  },
  "You cannot remove yourself.": {
    ko: "본인은 퇴출할 수 없어요.",
    en: "You cannot remove yourself.",
  },
  "You cannot remove the first creator.": {
    ko: "첫 생성자는 퇴출할 수 없어요.",
    en: "You cannot remove the first creator.",
  },
  "Creator cannot leave dashboard": {
    ko: "대시보드를 처음 만든 사용자는 나갈 수 없어요.",
    en: "Creator cannot leave dashboard",
  },
  "Failed to leave dashboard.": {
    ko: "대시보드에서 나가지 못했어요.",
    en: "Failed to leave dashboard.",
  },
  "Invalid snapshot payload": {
    ko: "스냅샷 데이터 형식이 올바르지 않아요.",
    en: "Invalid snapshot payload",
  },
  "Dashboard ID mismatch": {
    ko: "대시보드 ID가 일치하지 않아요.",
    en: "Dashboard ID mismatch",
  },
  "Widget not found": {
    ko: "위젯을 찾을 수 없어요.",
    en: "Widget not found",
  },
  "Dashboard mismatch": {
    ko: "대시보드 정보가 일치하지 않아요.",
    en: "Dashboard mismatch",
  },
  "Missing widgetId": {
    ko: "위젯 ID가 필요해요.",
    en: "Missing widgetId",
  },
  "Invalid value": {
    ko: "값이 올바르지 않아요.",
    en: "Invalid value",
  },
  "Server sync failed": {
    ko: "서버 동기화에 실패했어요.",
    en: "Server sync failed",
  },
  "Snapshot sync failed": {
    ko: "스냅샷 동기화에 실패했어요.",
    en: "Snapshot sync failed",
  },
  "Photo upload failed": {
    ko: "사진 업로드에 실패했어요.",
    en: "Photo upload failed",
  },
  "Missing local photo blob": {
    ko: "로컬 사진 데이터가 없어요.",
    en: "Missing local photo blob",
  },
  "Unsupported entity type": {
    ko: "지원하지 않는 엔티티 타입이에요.",
    en: "Unsupported entity type",
  },
  "Failed to fetch": {
    ko: "네트워크 요청에 실패했어요.",
    en: "Failed to fetch",
  },
  "Load failed": {
    ko: "네트워크 요청에 실패했어요.",
    en: "Load failed",
  },
  "Network request failed": {
    ko: "네트워크 요청에 실패했어요.",
    en: "Network request failed",
  },
  "Failed to fetch special days.": {
    ko: "공휴일/기념일 정보를 불러오지 못했어요.",
    en: "Failed to fetch special days.",
  },
  "Failed to load weather information.": {
    ko: "날씨 정보를 불러오지 못했어요.",
    en: "Failed to load weather information.",
  },
  "fetch-failed": {
    ko: "요청을 처리하지 못했어요.",
    en: "Fetch failed",
  },
  "Invalid coordinates.": {
    ko: "좌표 값이 올바르지 않아요.",
    en: "Invalid coordinates.",
  },
  "Coordinates out of range.": {
    ko: "좌표 범위를 벗어났어요.",
    en: "Coordinates out of range.",
  },
  "Reverse geocode failed.": {
    ko: "위치 이름을 가져오지 못했어요.",
    en: "Reverse geocode failed.",
  },
  "Missing path": {
    ko: "경로가 필요해요.",
    en: "Missing path",
  },
  "Invalid path": {
    ko: "경로가 올바르지 않아요.",
    en: "Invalid path",
  },
  "File not found": {
    ko: "파일을 찾을 수 없어요.",
    en: "File not found",
  },
};

export function localizeErrorMessage(message: string, t: TranslateFn): string {
  const trimmed = message.trim();

  if (trimmed in MESSAGE_MAP) {
    const mapped = MESSAGE_MAP[trimmed];
    return t(mapped.ko, mapped.en);
  }

  if (trimmed.startsWith("Missing field:")) {
    const field = trimmed.slice("Missing field:".length).trim();
    return t(`필수 값이 누락됐어요: ${field}`, `Missing field: ${field}`);
  }

  if (trimmed.startsWith("User not found")) {
    return t("사용자를 찾을 수 없어요.", "User not found");
  }

  const seemsEnglishOnly =
    /[A-Za-z]/.test(trimmed) && !/[ㄱ-ㅎ가-힣ㅏ-ㅣ]/.test(trimmed);
  if (seemsEnglishOnly) {
    return t("알 수 없는 오류가 발생했어요.", trimmed);
  }

  return trimmed;
}
