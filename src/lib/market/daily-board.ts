import { getSql } from "../db.ts";

export type DailyBoardRecord = {
  version: string;
  asOf: string;
  snapshot: unknown;
};

export async function writeDailyBoard(snapshot: unknown, asOf = new Date()): Promise<string> {
  const version = asOf.toISOString();
  try {
    const sql = await getSql();
    await sql`
      INSERT INTO daily_board (version, as_of, snapshot)
      VALUES (${version}, ${asOf.toISOString()}, ${JSON.stringify(snapshot)})
      ON CONFLICT (version) DO UPDATE SET snapshot = ${JSON.stringify(snapshot)}, as_of = ${asOf.toISOString()}
    `;
    await sql`
      INSERT INTO daily_board (version, as_of, snapshot)
      VALUES ('current', ${asOf.toISOString()}, ${JSON.stringify(snapshot)})
      ON CONFLICT (version) DO UPDATE SET snapshot = ${JSON.stringify(snapshot)}, as_of = ${asOf.toISOString()}
    `;
  } catch (e) {
    console.error("[daily-board] write failed:", e);
  }
  return version;
}

export async function readCurrentDailyBoard(): Promise<DailyBoardRecord | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ version: string; as_of: string; snapshot: unknown }>`
      SELECT version, as_of, snapshot FROM daily_board WHERE version = 'current'
    `;
    const row = rows[0];
    if (!row) return null;
    return { version: row.version, asOf: String(row.as_of), snapshot: row.snapshot };
  } catch {
    return null;
  }
}
