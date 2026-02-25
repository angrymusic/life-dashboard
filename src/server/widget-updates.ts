type WidgetUpdateType = "upsert" | "delete";

export type WidgetUpdateMessage = {
  dashboardId: string;
  widgetId: string;
  type: WidgetUpdateType;
  updatedAt: string;
  clientId?: string;
};

type WidgetUpdateListener = (message: WidgetUpdateMessage) => void;

type WidgetUpdateBusState = {
  listenersByDashboardId: Map<string, Set<WidgetUpdateListener>>;
};

declare global {
  var __lifedashboardWidgetUpdateBus: WidgetUpdateBusState | undefined;
}

const state: WidgetUpdateBusState = globalThis.__lifedashboardWidgetUpdateBus ?? {
  listenersByDashboardId: new Map(),
};

if (!globalThis.__lifedashboardWidgetUpdateBus) {
  globalThis.__lifedashboardWidgetUpdateBus = state;
}

export function publishWidgetUpdate(message: WidgetUpdateMessage) {
  const listeners = state.listenersByDashboardId.get(message.dashboardId);
  if (!listeners?.size) return;

  for (const listener of listeners) {
    try {
      listener(message);
    } catch {
      // Listener failures must not affect other subscribers.
    }
  }
}

export function subscribeWidgetUpdate(
  dashboardId: string,
  listener: WidgetUpdateListener
) {
  const listeners =
    state.listenersByDashboardId.get(dashboardId) ?? new Set<WidgetUpdateListener>();
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
