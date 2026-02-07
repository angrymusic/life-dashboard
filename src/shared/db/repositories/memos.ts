import type { Memo } from "../schema";
import { db, nowIso } from "../core";
import {
  applyEventsToServer,
  buildUpsertEventForRecord,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

export async function updateMemoText(
  memo: Memo,
  text: string,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(memo.dashboardId, options);
  const now = nowIso();
  const nextMemo: Memo = { ...memo, text, updatedAt: now };
  await db.transaction("rw", [db.memos, db.outbox], async () => {
    await db.memos.update(memo.id, { text, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "memo",
      record: nextMemo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("memo", nextMemo, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}
