type WidgetLockBroadcast = {
  widgetId: string;
  userId: string;
  displayName: string;
  expiresAt: string;
};

type WidgetLockUpdateMessage =
  | {
      dashboardId: string;
      type: "upsert";
      lock: WidgetLockBroadcast;
    }
  | {
      dashboardId: string;
      type: "delete";
      widgetId: string;
    };

type WidgetLockUpdateListener = (message: WidgetLockUpdateMessage) => void;

type WidgetLockUpdateBusState = {
  listenersByDashboardId: Map<string, Set<WidgetLockUpdateListener>>;
};

declare global {
  var __lifedashboardWidgetLockUpdateBus: WidgetLockUpdateBusState | undefined;
}

const state: WidgetLockUpdateBusState = globalThis.__lifedashboardWidgetLockUpdateBus ?? {
  listenersByDashboardId: new Map(),
};

if (!globalThis.__lifedashboardWidgetLockUpdateBus) {
  globalThis.__lifedashboardWidgetLockUpdateBus = state;
}

export function publishWidgetLockUpdate(message: WidgetLockUpdateMessage) {
  const listeners = state.listenersByDashboardId.get(message.dashboardId);
  if (!listeners?.size) return;

  for (const listener of listeners) {
    try {
      listener(message);
    } catch {
      // Ignore listener failures to keep broadcast resilient.
    }
  }
}

export function subscribeWidgetLockUpdate(
  dashboardId: string,
  listener: WidgetLockUpdateListener
) {
  const listeners =
    state.listenersByDashboardId.get(dashboardId) ?? new Set<WidgetLockUpdateListener>();
  listeners.add(listener);
  state.listenersByDashboardId.set(dashboardId, listeners);

  return () => {
    const current = state.listenersByDashboardId.get(dashboardId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      state.listenersByDashboardId.delete(dashboardId);
    }
  };
}
