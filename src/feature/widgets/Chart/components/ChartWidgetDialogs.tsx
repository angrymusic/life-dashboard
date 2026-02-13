import type { FormEvent } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { Id, MetricEntry, YMD } from "@/shared/db/schema";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  formatLongDate,
  formatValue,
} from "@/feature/widgets/Chart/libs/chartFormatters";
import { useI18n } from "@/shared/i18n/client";

type RecordManagementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  entries: MetricEntry[];
  unitLabel: string;
  newEntryDate: YMD;
  setNewEntryDate: (value: YMD) => void;
  newEntryValue: string;
  setNewEntryValue: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  editingEntryId: Id | null;
  editingDate: YMD | "";
  setEditingDate: (value: YMD) => void;
  editingValue: string;
  setEditingValue: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEdit: (entry: MetricEntry) => void;
  onDelete: (id: Id) => void;
};

export function RecordManagementDialog({
  open,
  onOpenChange,
  canEdit,
  entries,
  unitLabel,
  newEntryDate,
  setNewEntryDate,
  newEntryValue,
  setNewEntryValue,
  onSubmit,
  editingEntryId,
  editingDate,
  setEditingDate,
  editingValue,
  setEditingValue,
  onSaveEdit,
  onCancelEdit,
  onEdit,
  onDelete,
}: RecordManagementDialogProps) {
  const { t, locale } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("기록 관리", "Record management")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="grid gap-2 sm:grid-cols-[auto_1fr_auto]"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">{t("날짜", "Date")}</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              value={newEntryDate}
              onChange={(event) => {
                if (!event.target.value) return;
                setNewEntryDate(event.target.value as YMD);
              }}
              disabled={!canEdit || Boolean(editingEntryId)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">{t("값", "Value")}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                value={newEntryValue}
                onChange={(event) => setNewEntryValue(event.target.value)}
                placeholder={t("값을 입력하세요", "Enter a value")}
                autoFocus
                disabled={!canEdit || Boolean(editingEntryId)}
              />
              {unitLabel ? (
                <span className="text-xs text-gray-400">{unitLabel}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="lg"
              className="px-4"
              disabled={
                !canEdit || !newEntryValue.trim() || Boolean(editingEntryId)
              }
            >
              {t("추가", "Add")}
            </Button>
          </div>
        </form>

        <div
          className="mt-3 max-h-[320px] min-h-[120px] overflow-y-scroll pr-1"
          style={{ scrollbarGutter: "stable" }}
        >
          {entries.length === 0 ? (
            <div className="text-xs text-gray-400">
              {t("아직 기록이 없어요.", "No records yet.")}
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200/70 px-2 py-1 text-sm dark:border-gray-700"
                >
                  {editingEntryId === entry.id ? (
                    <>
                      <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:pr-2">
                        <input
                          type="date"
                          className="w-full min-w-0 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-base outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-700 sm:w-[140px]"
                          value={editingDate}
                          onChange={(event) => {
                            setEditingDate(event.target.value as YMD);
                          }}
                          disabled={!canEdit}
                        />
                        <input
                          type="number"
                          step="0.1"
                          className="w-full min-w-0 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-base outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-700 sm:w-[120px]"
                          value={editingValue}
                          onChange={(event) =>
                            setEditingValue(event.target.value)
                          }
                          disabled={!canEdit}
                        />
                        {unitLabel ? (
                          <span className="text-xs text-gray-400">
                            {unitLabel}
                          </span>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            onClick={() => void onSaveEdit()}
                            aria-label={t("기록 저장", "Save record")}
                            disabled={!editingValue.trim() || !editingDate}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={onCancelEdit}
                            aria-label={t("편집 취소", "Cancel edit")}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-500">
                          {formatLongDate(entry.date, locale)}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatValue(entry.value, locale, unitLabel || undefined)}
                        </span>
                      </div>
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(entry)}
                            className="rounded-md p-1 text-gray-400 transition hover:text-gray-600"
                            aria-label={t("기록 수정", "Edit record")}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(entry.id)}
                            className="rounded-md p-1 text-gray-400 transition hover:text-gray-600"
                            aria-label={t("기록 삭제", "Delete record")}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("닫기", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ChartSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  draftName: string;
  setDraftName: (value: string) => void;
  saveName: () => Promise<void>;
  draftUnit: string;
  setDraftUnit: (value: string) => void;
  saveUnit: () => Promise<void>;
  chartType: "line" | "bar";
  setChartType: (value: "line" | "bar") => Promise<void>;
  onSave: () => Promise<void>;
  onCancel: () => void;
};

export function ChartSettingsDialog({
  open,
  onOpenChange,
  canEdit,
  draftName,
  setDraftName,
  saveName,
  draftUnit,
  setDraftUnit,
  saveUnit,
  chartType,
  setChartType,
  onSave,
  onCancel,
}: ChartSettingsDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("차트 설정", "Chart settings")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">{t("차트 이름", "Chart name")}</label>
            <input
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
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
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("취소", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void onSave()}>
            {t("설정", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
