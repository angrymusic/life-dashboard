import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrorMessage";

const t = (ko: string, en: string) => `${ko} | ${en}`;

describe("getAuthErrorMessage", () => {
  it("returns null when there is no auth error", () => {
    expect(getAuthErrorMessage(null, t)).toBeNull();
    expect(getAuthErrorMessage("   ", t)).toBeNull();
  });

  it("maps grouped OAuth-style failures to a retry message", () => {
    expect(getAuthErrorMessage("OAuthCallback", t)).toBe(
      "로그인에 실패했어요. 다른 계정으로 다시 시도해 주세요. | Sign-in failed. Try again with a different account."
    );
    expect(getAuthErrorMessage("CredentialsSignin", t)).toBe(
      "로그인에 실패했어요. 다른 계정으로 다시 시도해 주세요. | Sign-in failed. Try again with a different account."
    );
  });

  it("returns a dedicated message for account-link conflicts", () => {
    expect(getAuthErrorMessage("OAuthAccountNotLinked", t)).toBe(
      "이전에 사용한 동일한 계정으로 다시 로그인해 주세요. | Sign in with the same account you used before."
    );
  });

  it("supports configuration errors regardless of casing", () => {
    expect(getAuthErrorMessage("Configuration", t)).toBe(
      "로그인 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요. | There's a configuration problem with sign-in. Please try again later."
    );
    expect(getAuthErrorMessage("configuration", t)).toBe(
      "로그인 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요. | There's a configuration problem with sign-in. Please try again later."
    );
  });

  it("falls back to a generic message for unknown error codes", () => {
    expect(getAuthErrorMessage("UnexpectedError", t)).toBe(
      "로그인에 실패했어요. 다시 시도해 주세요. | Unable to sign in."
    );
  });
});
