import { getSql } from "../db.ts";

const MORNING_PULL_LOCK = 93027;

export async function tryMorningPullLock(): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [MORNING_PULL_LOCK]);
    return Boolean(rows[0]?.locked);
  } catch (e) {
    console.warn("[advisory-lock] try failed, proceeding without lock:", e);
    return true;
  }
}

export async function releaseMorningPullLock(): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query("SELECT pg_advisory_unlock($1)", [MORNING_PULL_LOCK]);
  } catch {
    // ignore — lock is session-scoped and dies with the connection
  }
}
