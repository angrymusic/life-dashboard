import { RecordManagementDialog, ChartSettingsDialog } from "@/feature/widgets/Chart/components/ChartWidgetDialogs";
import {
  formatLongDate,
  formatShortDate,
  formatValue,
} from "@/feature/widgets/Chart/libs/chartFormatters";
import { useChartWidget } from "@/feature/widgets/Chart/hooks/useChartWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { updateWidgetSettings } from "@/shared/db/db";
import type { Id, YMD } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";
import { Button } from "@/shared/ui/button";
import { List, Pencil } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function ChartWidget({ widgetId, canEdit = true }: ChartWidgetProps) {
  const { t, locale } = useI18n();
  const {
    metric,
    widget,
    metricsLoaded,
    entries,
    draftName,
    setDraftName,
    saveName,
    draftUnit,
    setDraftUnit,
    saveUnit,
    chartType,
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
  } = useChartWidget(widgetId);
  const [isEntriesOpen, setIsEntriesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const needsSetup =
    Boolean(metric) &&
    (widget?.settings?.isConfigured === false ||
      widget?.settings?.autoOpenSettings === true);
  const isConfigured = Boolean(metric) && !needsSetup;
  const entriesDialogOpen = isEntriesOpen && isConfigured;
  const settingsDialogOpen = isSettingsOpen && isConfigured;

  const handleEntriesOpenChange = (open: boolean) => {
    if (!isConfigured) return;
    setIsEntriesOpen(open);
    if (!open) cancelEditEntry();
  };

  const handleSettingsOpenChange = (open: boolean) => {
    if (!isConfigured) return;
    setIsSettingsOpen(open);
  };

  const handleCompleteSettings = async () => {
    if (!widget?.id) return;
    if (!metric) return;
    await Promise.all([saveName(), saveUnit()]);
    await updateWidgetSettings(widget.id, {
      ...widget.settings,
      isConfigured: true,
      autoOpenSettings: false,
    });
    setIsSettingsOpen(false);
  };

  const handleManageEntries = () => {
    if (!canEdit) return;
    if (!isConfigured) return;
    setIsEntriesOpen(true);
  };

  const handleAddFromDialog = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    if (editingEntryId) return;
    if (!newEntryValue.trim()) return;
    void addEntry();
  };

  const handleSettingsSave = async () => {
    await Promise.all([saveName(), saveUnit()]);
    setIsSettingsOpen(false);
  };

  const handleSettingsCancel = () => {
    setIsSettingsOpen(false);
  };

  const extraItems = isConfigured
    ? [
        {
          text: t("기록 관리", "Record management"),
          icon: <List />,
          onClick: handleManageEntries,
        },
        {
          text: t("차트 설정", "Chart settings"),
          icon: <Pencil />,
          onClick: () => handleSettingsOpenChange(true),
        },
      ]
    : [];
  const {
    actions,
    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      close: closeDeleteDialog,
      confirm: handleDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit,
    deleteLabel: t("위젯 삭제", "Delete widget"),
    extraItems,
  });

  const chartData = useMemo(
    () =>
      entries.map((entry) => ({
        date: entry.date,
        value: entry.value,
      })),
    [entries]
  );
  const unitLabel = metric?.unit?.trim() || "";
  const title = metric?.name?.trim() || t("차트", "Chart");

  return (
    <WidgetCard
      header={
        <WidgetHeader
          left={
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{title}</div>
              {unitLabel ? (
                <div className="text-xs text-gray-400">{unitLabel}</div>
              ) : null}
            </div>
          }
          actions={actions}
          canEdit={canEdit}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {!metricsLoaded ? (
          <div className="text-sm text-gray-400">{t("불러오는 중...", "Loading...")}</div>
        ) : !metric ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 text-sm text-gray-500">
            <div>{t("지표가 없습니다.", "No metric yet.")}</div>
            {canEdit ? (
              <Button type="button" size="sm" onClick={() => void createMetric()}>
                {t("지표 생성", "Create metric")}
              </Button>
            ) : null}
          </div>
        ) : needsSetup ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="text-sm text-gray-500">
              {t("설정을 완료하면 차트가 표시됩니다.", "Complete settings to display the chart.")}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{t("차트 이름", "Chart name")}</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => void saveName()}
                  placeholder={t("예: 체중, 키, 공부 시간", "e.g., Weight, Height, Study time")}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{t("단위", "Unit")}</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  value={draftUnit}
                  onChange={(event) => setDraftUnit(event.target.value)}
                  onBlur={() => void saveUnit()}
                  placeholder={t("예: kg, cm", "e.g., kg, cm")}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{t("차트", "Chart")}</label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={chartType === "line" ? "default" : "outline"}
                    onClick={() => void setChartType("line")}
                    disabled={!canEdit}
                  >
                    {t("선", "Line")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartType === "bar" ? "default" : "outline"}
                    onClick={() => void setChartType("bar")}
                    disabled={!canEdit}
                  >
                    {t("막대", "Bar")}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleCompleteSettings}
                disabled={!canEdit}
              >
                {t("설정 완료", "Done")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-h-[220px] flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex min-h-[180px] flex-1 rounded-md border border-gray-200/70 dark:border-gray-700 p-2 overflow-hidden">
                {chartData.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    {t("기록이 없습니다", "No records")}
                  </div>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    minHeight={180}
                    initialDimension={{ width: 1, height: 1 }}
                  >
                    {chartType === "bar" ? (
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 12, bottom: 8, left: -6 }}
                      >
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) =>
                            formatShortDate(value as YMD, locale)
                          }
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={12}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          formatter={(value) => [
                            formatValue(Number(value), locale, unitLabel || undefined),
                            title,
                          ]}
                          labelFormatter={(label) =>
                            formatLongDate(label as YMD, locale)
                          }
                          contentStyle={{
                            background: "var(--popover)",
                            borderRadius: 8,
                            borderColor: "var(--border)",
                            fontSize: "12px",
                          }}
                          labelStyle={{
                            color: "var(--muted-foreground)",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill="var(--chart-2)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    ) : (
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 12, bottom: 8, left: -6 }}
                      >
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) =>
                            formatShortDate(value as YMD, locale)
                          }
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={12}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          formatter={(value) => [
                            formatValue(Number(value), locale, unitLabel || undefined),
                            title,
                          ]}
                          labelFormatter={(label) =>
                            formatLongDate(label as YMD, locale)
                          }
                          contentStyle={{
                            background: "var(--popover)",
                            borderRadius: 8,
                            borderColor: "var(--border)",
                            fontSize: "12px",
                          }}
                          labelStyle={{
                            color: "var(--muted-foreground)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "var(--chart-1)" }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

            </div>
          </>
        )}

        {isConfigured ? (
          <RecordManagementDialog
            open={entriesDialogOpen}
            onOpenChange={handleEntriesOpenChange}
            canEdit={canEdit}
            entries={entries}
            unitLabel={unitLabel}
            newEntryDate={newEntryDate}
            setNewEntryDate={setNewEntryDate}
            newEntryValue={newEntryValue}
            setNewEntryValue={setNewEntryValue}
            onSubmit={handleAddFromDialog}
            editingEntryId={editingEntryId}
            editingDate={editingDate}
            setEditingDate={setEditingDate}
            editingValue={editingValue}
            setEditingValue={setEditingValue}
            onSaveEdit={saveEntryEdit}
            onCancelEdit={cancelEditEntry}
            onEdit={beginEditEntry}
            onDelete={deleteEntry}
          />
        ) : null}

        {isConfigured ? (
          <ChartSettingsDialog
            open={settingsDialogOpen}
            onOpenChange={handleSettingsOpenChange}
            canEdit={canEdit}
            draftName={draftName}
            setDraftName={setDraftName}
            saveName={saveName}
            draftUnit={draftUnit}
            setDraftUnit={setDraftUnit}
            saveUnit={saveUnit}
            chartType={chartType}
            setChartType={setChartType}
            onSave={handleSettingsSave}
            onCancel={handleSettingsCancel}
          />
        ) : null}

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName={t("차트", "Chart")}
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
