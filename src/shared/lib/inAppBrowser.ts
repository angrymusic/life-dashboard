const IN_APP_BROWSER_PATTERN =
  /kakaotalk|naver|line|instagram|fban|fbav|fb_iab|daumapps|webview|; wv\)/i;
const KAKAOTALK_PATTERN = /kakaotalk/i;
const ANDROID_PATTERN = /android/i;
const IOS_PATTERN = /iphone|ipad|ipod/i;

export const detectInAppBrowser = (userAgent: string): boolean =>
  IN_APP_BROWSER_PATTERN.test(userAgent);

export const isInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return detectInAppBrowser(navigator.userAgent);
};

export const buildExternalBrowserOpenUrl = (
  currentUrl: string,
  userAgent: string
): string | null => {
  if (!currentUrl) return null;

  if (ANDROID_PATTERN.test(userAgent)) {
    try {
      const parsedUrl = new URL(currentUrl);
      const pathWithQueryAndHash = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      const scheme = parsedUrl.protocol.replace(":", "");
      return `intent://${parsedUrl.host}${pathWithQueryAndHash}#Intent;scheme=${scheme};end`;
    } catch {
      return null;
    }
  }

  if (KAKAOTALK_PATTERN.test(userAgent)) {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
  }

  if (IOS_PATTERN.test(userAgent)) {
    if (currentUrl.startsWith("https://")) {
      return currentUrl.replace("https://", "googlechromes://");
    }
    if (currentUrl.startsWith("http://")) {
      return currentUrl.replace("http://", "googlechrome://");
    }
  }

  return null;
};
