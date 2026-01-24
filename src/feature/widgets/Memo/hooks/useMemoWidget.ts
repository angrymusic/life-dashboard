import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import { useMemoOne } from "@/shared/db/queries";
import { db, nowIso } from "@/shared/db/db";
import type { Id } from "@/shared/db/schema";

export function useMemoWidget(widgetId: Id) {
  const memo = useMemoOne(widgetId);

  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;

  const value = useMemo(() => draft ?? memo?.text ?? "", [draft, memo?.text]);

  const beginEdit = useCallback(() => {
    if (!memo) return;
    if (isEditing) return;
    setDraft(memo.text);
  }, [memo, isEditing]);

  const cancelEdit = useCallback(() => {
    setDraft(null);
  }, []);

  const save = useCallback(async () => {
    if (!memo) return;
    if (draft === null) return;

    if (draft === memo.text) {
      setDraft(null);
      return;
    }

    await db.memos.update(memo.id, {
      text: draft,
      updatedAt: nowIso(),
    });

    setDraft(null);
  }, [memo, draft]);

  const handleFocus = useCallback(
    (_event: FocusEvent<HTMLTextAreaElement>) => {
      beginEdit();
    },
    [beginEdit]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (!memo) return;
      setDraft(event.target.value);
    },
    [memo]
  );

  const handleBlur = useCallback(
    (_event: FocusEvent<HTMLTextAreaElement>) => {
      void save();
    },
    [save]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
        event.currentTarget.blur();
      }
    },
    [cancelEdit]
  );

  return {
    memo,
    value,
    isEditing,
    beginEdit,
    handleFocus,
    handleChange,
    handleBlur,
    handleKeyDown,
  };
}
