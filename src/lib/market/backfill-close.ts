import { getSql } from "../db.ts";

export async function backfillClosePrices(): Promise<number> {
  try {
    const sql = await getSql();
    await sql.query(`ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS close_price integer`);
    const rows = await sql.query<{ id: string }>(`
      UPDATE market_tape AS t
      SET close_price = later.price
      FROM (
        SELECT DISTINCT ON (event_id, market_type, coalesce(side, ''))
          event_id,
          market_type,
          coalesce(side, '') AS side,
          price
        FROM market_tape
        WHERE price IS NOT NULL
        ORDER BY event_id, market_type, coalesce(side, ''), snapped_at DESC
      ) later
      WHERE t.close_price IS NULL
        AND t.event_id = later.event_id
        AND t.market_type = later.market_type
        AND coalesce(t.side, '') = later.side
        AND t.status IN ('WIN', 'LOSS', 'PUSH')
      RETURNING t.id
    `);
    return rows.length;
  } catch (e) {
    console.error("[backfill-close] failed:", e);
    return 0;
  }
}
