import { getSql } from "@/lib/db";

export async function runSweeper() {
  const sql = await getSql();
  const result = await sql`SELECT * FROM desk_ledger WHERE status = 'pending'`;
  const pending = result.rows || result;
  
  let hits = 0;
  let misses = 0;

  for (const ticket of pending) {
    const isHit = Math.random() > 0.4; 
    const newResult = isHit ? 'hit' : 'miss';
    
    await sql`
      UPDATE desk_ledger 
      SET status = 'settled', result = ${newResult}
      WHERE id = ${ticket.id}
    `;
    
    if (isHit) hits++;
    else misses++;
  }
  
  return { swept: pending.length, hits, misses };
}