import type { TranslateFn } from "@/shared/i18n/errorMessage";

const AUTH_ERROR_GROUP_MESSAGES = new Set([
  "signin",
  "oauthsignin",
  "oauthcallback",
  "oauthcreateaccount",
  "emailcreateaccount",
  "callback",
  "credentialssignin",
]);

export function getAuthErrorMessage(
  errorCode: string | null | undefined,
  t: TranslateFn
) {
  const normalized = errorCode?.trim().toLowerCase();
  if (!normalized) return null;

  if (AUTH_ERROR_GROUP_MESSAGES.has(normalized)) {
    return t(
      "로그인에 실패했어요. 다른 계정으로 다시 시도해 주세요.",
      "Sign-in failed. Try again with a different account."
    );
  }

  switch (normalized) {
    case "accessdenied":
      return t(
        "이 계정으로는 로그인을 진행할 수 없어요.",
        "This account is not allowed to sign in."
      );
    case "oauthaccountnotlinked":
      return t(
        "이전에 사용한 동일한 계정으로 다시 로그인해 주세요.",
        "Sign in with the same account you used before."
      );
    case "emailsignin":
      return t(
        "로그인 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
        "We couldn't start sign-in. Please try again in a moment."
      );
    case "sessionrequired":
      return t(
        "이 기능을 사용하려면 먼저 로그인해 주세요.",
        "Please sign in to access this page."
      );
    case "verification":
      return t(
        "로그인 확인이 만료되었거나 이미 사용되었어요. 다시 시도해 주세요.",
        "This sign-in link is expired or already used. Please try again."
      );
    case "configuration":
      return t(
        "로그인 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
        "There's a configuration problem with sign-in. Please try again later."
      );
    default:
      return t("로그인에 실패했어요. 다시 시도해 주세요.", "Unable to sign in.");
  }
}
