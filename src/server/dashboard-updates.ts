type DashboardUpdateMessage = {
  dashboardId: string;
  updatedAt: string;
  clientId?: string;
};

type DashboardUpdateListener = (message: DashboardUpdateMessage) => void;

type DashboardUpdateMeta = {
  updatedAt: string;
  clientId?: string;
};

type DashboardUpdateBusState = {
  listenersByDashboardId: Map<string, Set<DashboardUpdateListener>>;
  latestByDashboardId: Map<string, DashboardUpdateMeta>;
};

declare global {
  var __lifedashboardDashboardUpdateBus: DashboardUpdateBusState | undefined;
}

const state: DashboardUpdateBusState = globalThis.__lifedashboardDashboardUpdateBus ?? {
  listenersByDashboardId: new Map(),
  latestByDashboardId: new Map(),
};

if (!globalThis.__lifedashboardDashboardUpdateBus) {
  globalThis.__lifedashboardDashboardUpdateBus = state;
}

export function publishDashboardUpdate(message: DashboardUpdateMessage) {
  const prev = state.latestByDashboardId.get(message.dashboardId);
  if (!prev || prev.updatedAt <= message.updatedAt) {
    state.latestByDashboardId.set(message.dashboardId, {
      updatedAt: message.updatedAt,
      ...(message.clientId ? { clientId: message.clientId } : {}),
    });
  }

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

export function subscribeDashboardUpdate(
  dashboardId: string,
  listener: DashboardUpdateListener
) {
  const listeners =
    state.listenersByDashboardId.get(dashboardId) ?? new Set<DashboardUpdateListener>();
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

export function getLatestDashboardUpdate(dashboardId: string) {
  return state.latestByDashboardId.get(dashboardId) ?? null;
}
