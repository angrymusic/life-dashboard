import { useMemo, useState } from "react";
import { WidgetCard } from "../../common/WidgetCard";
import { useMemos } from "@/db/queries";
import { db, nowIso } from "@/db/db";

type Props = {
  widgetId: string;
};

export function MemoWidget({ widgetId }: Props) {
  const memos = useMemos(widgetId);
  const memo = memos?.[0];

  // 편집 중일 때만 draft를 가진다
  const [draft, setDraft] = useState<string | null>(null);

  const isEditing = draft !== null;

  const value = useMemo(() => {
    // 편집 중이면 draft, 아니면 DB값을 그대로 렌더
    return draft ?? memo?.text ?? "";
  }, [draft, memo?.text]);

  const beginEdit = () => {
    if (!memo) return;
    if (isEditing) return;
    setDraft(memo.text);
  };

  const cancelEdit = () => {
    setDraft(null);
  };

  const save = async () => {
    if (!memo) return;
    if (draft === null) return;

    // 변경 없으면 그냥 종료
    if (draft === memo.text) {
      setDraft(null);
      return;
    }

    await db.memos.update(memo.id, {
      text: draft,
      updatedAt: nowIso(),
    });

    setDraft(null);
  };

  if (!memos) {
    return (
      <WidgetCard title="Memo">
        <div className="text-sm text-gray-400">Loading...</div>
      </WidgetCard>
    );
  }

  if (!memo) {
    return (
      <WidgetCard title="Memo">
        <div className="text-sm text-gray-500">
          메모 데이터가 없습니다. (위젯 생성 시 memo 레코드를 생성하도록
          addWidget 로직을 확인하세요)
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Memo">
      <div className="flex h-full min-h-0 flex-col">
        <textarea
          className="w-full flex-1 min-h-0 resize-none rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          placeholder="메모를 입력하세요"
          onFocus={beginEdit}
          onChange={(e) => {
            if (!isEditing) beginEdit();
            setDraft(e.target.value);
          }}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
              e.currentTarget.blur();
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
              e.currentTarget.blur();
            }
          }}
        />

        <div className="mt-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>저장: 포커스 아웃 / Ctrl(⌘)+Enter · 취소: Esc</span>
          {isEditing ? <span>● 편집 중</span> : null}
        </div>
      </div>
    </WidgetCard>
  );
}
