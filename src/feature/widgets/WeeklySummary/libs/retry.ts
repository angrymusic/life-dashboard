const WIDGET_NOT_FOUND_ERROR = "Widget not found";
export const TRANSIENT_WIDGET_NOT_FOUND_WINDOW_MS = 30 * 1000;

export function shouldRetryMissingWidget(params: {
  errorMessage?: string | null;
  widgetCreatedAt?: string;
  now?: number;
}) {
  if ((params.errorMessage ?? "").trim() !== WIDGET_NOT_FOUND_ERROR) {
    return false;
  }

  if (!params.widgetCreatedAt) {
    return false;
  }

  const createdAtMs = Date.parse(params.widgetCreatedAt);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  const ageMs = (params.now ?? Date.now()) - createdAtMs;
  return ageMs >= 0 && ageMs <= TRANSIENT_WIDGET_NOT_FOUND_WINDOW_MS;
}
