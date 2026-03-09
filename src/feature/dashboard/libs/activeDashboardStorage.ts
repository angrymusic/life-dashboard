import { getOrCreateLocalProfileId } from "@/shared/db/db";

export function getLastActiveDashboardStorageKey(
  authEmail: string | null | undefined
) {
  const normalizedEmail = authEmail?.trim().toLowerCase();

  return normalizedEmail
    ? `lifedashboard.lastActiveDashboardId:${normalizedEmail}`
    : `lifedashboard.lastActiveDashboardId:local:${getOrCreateLocalProfileId()}`;
}

export function persistLastActiveDashboardId(
  dashboardId: string,
  authEmail: string | null | undefined
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getLastActiveDashboardStorageKey(authEmail),
    dashboardId
  );
}
