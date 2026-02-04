import { useCallback, useMemo, useState } from "react";
import {
  addMetricEntry,
  createMetric as createMetricRecord,
  deleteMetricEntry,
  updateMetric as updateMetricRecord,
  updateMetricEntry,
} from "@/shared/db/db";
import type { Id, Metric, MetricEntry, YMD } from "@/shared/db/schema";
import { useMetricEntries, useMetrics, useWidget } from "@/shared/db/queries";

type ChartType = "line" | "bar";
type DraftField<T> = { metricId: Id; value: T } | null;

function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

export function useChartWidget(widgetId: Id) {
  const widget = useWidget(widgetId);
  const metrics = useMetrics(widgetId);
  const metric = useMemo(() => metrics?.[0] ?? null, [metrics]);
  const entries = useMetricEntries(metric?.id ?? "__none__");

  const [draftName, setDraftNameState] = useState<DraftField<string>>(null);
  const [draftUnit, setDraftUnitState] = useState<DraftField<string>>(null);
  const [draftChartType, setDraftChartTypeState] =
    useState<DraftField<ChartType>>(null);
  const [newEntryDate, setNewEntryDate] = useState<YMD>(() =>
    toYmd(new Date())
  );
  const [newEntryValue, setNewEntryValue] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<Id | null>(null);
  const [editingDate, setEditingDate] = useState<YMD | "">("");
  const [editingValue, setEditingValue] = useState("");

  const metricId = metric?.id;
  const resolvedDraftName =
    metricId && draftName?.metricId === metricId
      ? draftName.value
      : metric?.name ?? "";
  const resolvedDraftUnit =
    metricId && draftUnit?.metricId === metricId
      ? draftUnit.value
      : metric?.unit ?? "";
  const resolvedChartType =
    metricId && draftChartType?.metricId === metricId
      ? draftChartType.value
      : metric?.chartType ?? "line";

  const updateMetric = useCallback(
    async (updates: Partial<Metric>) => {
      if (!metric) return;
      await updateMetricRecord(metric, updates);
    },
    [metric]
  );

  const saveName = useCallback(async () => {
    if (!metric) return;
    const trimmed = resolvedDraftName.trim();
    const nextName = trimmed || "지표";
    if (nextName === metric.name) {
      if (nextName !== resolvedDraftName) {
        setDraftNameState({ metricId: metric.id, value: nextName });
      }
      return;
    }
    await updateMetric({ name: nextName });
    setDraftNameState({ metricId: metric.id, value: nextName });
  }, [metric, resolvedDraftName, updateMetric]);

  const saveUnit = useCallback(async () => {
    if (!metric) return;
    const trimmed = resolvedDraftUnit.trim();
    const currentUnit = metric.unit ?? "";
    if (trimmed === currentUnit) {
      if (trimmed !== resolvedDraftUnit) {
        setDraftUnitState({ metricId: metric.id, value: trimmed });
      }
      return;
    }
    await updateMetric({ unit: trimmed || undefined });
    setDraftUnitState({ metricId: metric.id, value: trimmed });
  }, [metric, resolvedDraftUnit, updateMetric]);

  const setChartType = useCallback(
    async (nextType: ChartType) => {
      if (!metric) return;
      setDraftChartTypeState({ metricId: metric.id, value: nextType });
      if ((metric.chartType ?? "line") === nextType) return;
      await updateMetric({ chartType: nextType });
    },
    [metric, updateMetric]
  );

  const setDraftName = useCallback(
    (value: string) => {
      if (!metric) return;
      setDraftNameState({ metricId: metric.id, value });
    },
    [metric]
  );

  const setDraftUnit = useCallback(
    (value: string) => {
      if (!metric) return;
      setDraftUnitState({ metricId: metric.id, value });
    },
    [metric]
  );

  const createMetric = useCallback(async () => {
    if (!widget) return;
    await createMetricRecord({
      widgetId,
      dashboardId: widget.dashboardId,
      name: "지표",
      chartType: "line",
    });
  }, [widget, widgetId]);

  const addEntry = useCallback(async () => {
    if (!metric) return;
    if (!newEntryValue.trim()) return;
    const value = Number(newEntryValue);
    if (!Number.isFinite(value)) return;

    const existingEntry = entries?.find(
      (entry) => entry.date === newEntryDate
    );
    if (existingEntry) {
      await updateMetricEntry(existingEntry, { date: existingEntry.date, value });
    } else {
      await addMetricEntry({
        widgetId: metric.widgetId,
        dashboardId: metric.dashboardId,
        metricId: metric.id,
        date: newEntryDate,
        value,
      });
    }
    setNewEntryValue("");
  }, [metric, entries, newEntryDate, newEntryValue]);

  const saveEntryEdit = useCallback(async () => {
    if (!metric) return;
    if (!editingEntryId) return;
    if (!editingValue.trim()) return;
    if (!editingDate) return;

    const value = Number(editingValue);
    if (!Number.isFinite(value)) return;

    const editingEntry = entries?.find(
      (entry) => entry.id === editingEntryId
    );
    const existingEntry = entries?.find(
      (entry) => entry.date === editingDate && entry.id !== editingEntryId
    );

    if (existingEntry) {
      await updateMetricEntry(existingEntry, {
        date: existingEntry.date,
        value,
      });
      if (editingEntry) {
        await deleteMetricEntry(editingEntry.id);
      }
    } else if (editingEntry) {
      await updateMetricEntry(editingEntry, { date: editingDate, value });
    } else {
      await addMetricEntry({
        widgetId: metric.widgetId,
        dashboardId: metric.dashboardId,
        metricId: metric.id,
        date: editingDate,
        value,
      });
    }

    setEditingEntryId(null);
    setEditingDate("");
    setEditingValue("");
  }, [metric, entries, editingDate, editingEntryId, editingValue]);

  const beginEditEntry = useCallback((entry: MetricEntry) => {
    setEditingEntryId(entry.id);
    setEditingDate(entry.date);
    setEditingValue(String(entry.value));
  }, []);

  const cancelEditEntry = useCallback(() => {
    setEditingEntryId(null);
    setEditingDate("");
    setEditingValue("");
  }, []);

  const deleteEntry = useCallback(
    async (entryId: Id) => {
      await deleteMetricEntry(entryId);
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
        setEditingDate("");
        setEditingValue("");
      }
    },
    [editingEntryId]
  );

  const latestEntry = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return entries[entries.length - 1];
  }, [entries]);

  return {
    widget,
    metric,
    metricsLoaded: metrics !== undefined,
    entries: entries ?? [],
    latestEntry,
    draftName: resolvedDraftName,
    setDraftName,
    saveName,
    draftUnit: resolvedDraftUnit,
    setDraftUnit,
    saveUnit,
    chartType: resolvedChartType,
    setChartType,
    newEntryDate,
    setNewEntryDate,
    newEntryValue,
    setNewEntryValue,
    editingEntryId,
    editingDate,
    setEditingDate,
    editingValue,
    setEditingValue,
    beginEditEntry,
    cancelEditEntry,
    addEntry,
    saveEntryEdit,
    deleteEntry,
    createMetric,
  };
}
