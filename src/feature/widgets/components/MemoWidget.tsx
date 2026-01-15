import { Id } from "@/shared/db/schema";
import { WidgetCard } from "./WidgetCard";
import { useMemoWidget } from "@/feature/widgets/hooks/useMemoWidget";

type MemoWidgetProps = {
  widgetId: Id;
};
export function MemoWidget({ widgetId }: MemoWidgetProps) {
  const {
    value,
    isEditing,
    handleFocus,
    handleChange,
    handleBlur,
    handleKeyDown,
  } = useMemoWidget(widgetId);

  return (
    <WidgetCard title="Memo">
      <div className="flex h-full min-h-0 flex-col">
        <textarea
          className="w-full flex-1 min-h-0 resize-none rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          placeholder="메모를 입력하세요"
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />

        <div className="mt-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>저장: 포커스 아웃 / Ctrl(⌘)+Enter · 취소: Esc</span>
          {isEditing ? <span>● 편집 중</span> : null}
        </div>
      </div>
    </WidgetCard>
  );
}
