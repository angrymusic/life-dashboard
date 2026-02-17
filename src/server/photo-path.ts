import path from "path";

const UUID_SEGMENT =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const EXT_SEGMENT = "(jpg|jpeg|png|webp|gif|heic|heif|bin)";

const LEGACY_PHOTO_PATH_PATTERN = new RegExp(
  `^photos\\/\\d{4}\\/\\d{2}\\/${UUID_SEGMENT}\\.${EXT_SEGMENT}$`
);

const DASHBOARD_PHOTO_PATH_PATTERN = new RegExp(
  `^photos\\/([^/]+)\\/\\d{4}\\/\\d{2}\\/${UUID_SEGMENT}\\.${EXT_SEGMENT}$`
);

export function normalizeStoragePath(value: string) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  const trimmed = normalized.replace(/^\/+/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("..")) return null;
  return trimmed.toLowerCase();
}

export function isLegacyPhotoStoragePath(value: string) {
  const normalized = normalizeStoragePath(value);
  if (!normalized) return false;
  return LEGACY_PHOTO_PATH_PATTERN.test(normalized);
}

type PathValidationOptions = {
  allowLegacy?: boolean;
};

export function isValidPhotoStoragePathForDashboard(
  value: string,
  dashboardId: string,
  options: PathValidationOptions = {}
) {
  const normalized = normalizeStoragePath(value);
  if (!normalized) return false;

  const scopedMatch = normalized.match(DASHBOARD_PHOTO_PATH_PATTERN);
  if (scopedMatch?.[1]) {
    return scopedMatch[1] === dashboardId.toLowerCase();
  }

  if (options.allowLegacy) {
    return LEGACY_PHOTO_PATH_PATTERN.test(normalized);
  }

  return false;
}
