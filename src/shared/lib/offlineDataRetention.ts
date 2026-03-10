const KEEP_OFFLINE_DATA_ON_SESSION_END_KEY =
  "lifedashboard-preferences.keepOfflineDataOnSessionEnd";
const SIGN_OUT_DATA_POLICY_KEY = "lifedashboard-internal.signOutDataPolicy";

export type SignOutDataPolicy = "keep" | "clear";

function readStoredBoolean(key: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "1";
}

export function getKeepOfflineDataOnSessionEnd() {
  return readStoredBoolean(KEEP_OFFLINE_DATA_ON_SESSION_END_KEY);
}

export function setKeepOfflineDataOnSessionEnd(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEEP_OFFLINE_DATA_ON_SESSION_END_KEY,
    value ? "1" : "0"
  );
}

export function getPendingSignOutDataPolicy(): SignOutDataPolicy | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(SIGN_OUT_DATA_POLICY_KEY);
  return value === "keep" || value === "clear" ? value : null;
}

export function setPendingSignOutDataPolicy(policy: SignOutDataPolicy) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIGN_OUT_DATA_POLICY_KEY, policy);
}

export function clearPendingSignOutDataPolicy() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SIGN_OUT_DATA_POLICY_KEY);
}
