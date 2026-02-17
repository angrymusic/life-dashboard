import { describe, expect, it } from "vitest";
import {
  canEditWidgetByPermission,
  resolveDashboardPermissionState,
} from "./permissions";

describe("resolveDashboardPermissionState", () => {
  it("always allows widget creation in personal dashboards", () => {
    const state = resolveDashboardPermissionState({
      isSharedDashboard: false,
      isSignedIn: false,
    });

    expect(state.canCreateWidget).toBe(true);
    expect(state.isAdmin).toBe(true);
    expect(state.widgetCreatorId).toBeUndefined();
  });

  it("blocks shared dashboard edits for signed-out users", () => {
    const state = resolveDashboardPermissionState({
      isSharedDashboard: true,
      isSignedIn: false,
      member: { role: "child", userId: "u-1" },
    });

    expect(state.canCreateWidget).toBe(false);
    expect(canEditWidgetByPermission(state, { createdBy: "u-1" })).toBe(false);
  });

  it("allows admins to edit any shared widget", () => {
    const state = resolveDashboardPermissionState({
      isSharedDashboard: true,
      isSignedIn: true,
      member: { role: "parent", userId: "admin-1" },
    });

    expect(state.canCreateWidget).toBe(true);
    expect(canEditWidgetByPermission(state, { createdBy: "other-user" })).toBe(
      true
    );
  });

  it("allows child members to edit only their own widgets", () => {
    const state = resolveDashboardPermissionState({
      isSharedDashboard: true,
      isSignedIn: true,
      member: { role: "child", userId: "child-1" },
    });

    expect(canEditWidgetByPermission(state, { createdBy: "child-1" })).toBe(
      true
    );
    expect(canEditWidgetByPermission(state, { createdBy: "child-2" })).toBe(
      false
    );
    expect(state.widgetCreatorId).toBe("child-1");
  });
});
