import { getSql } from "@/lib/db";

export type LedgerTicket = {
  legs: any;
  combinedOdds: number;
  trueProb: number;
  stake: number;
};

let ledgerTableEnsured = false;

async function ensureLedgerTable(sql: any) {
  if (ledgerTableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS desk_ledger (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      legs JSONB,
      combined_odds NUMERIC,
      true_prob NUMERIC,
      stake NUMERIC,
      status VARCHAR DEFAULT 'pending',
      result VARCHAR DEFAULT NULL
    )
  `;
  ledgerTableEnsured = true;
}

export async function insertLedgerTicket(ticket: LedgerTicket): Promise<void> {
  const sql = await getSql();
  await ensureLedgerTable(sql);

  await sql`
    INSERT INTO desk_ledger (legs, combined_odds, true_prob, stake)
    VALUES (
      ${JSON.stringify(ticket.legs)}::jsonb,
      ${ticket.combinedOdds},
      ${ticket.trueProb},
      ${ticket.stake}
    )
  `;
}

export async function getLedgerTickets() {
  const sql = await getSql();
  await ensureLedgerTable(sql);

  const result = await sql`SELECT * FROM desk_ledger ORDER BY created_at DESC LIMIT 200`;
  return (result as any).rows || result;
}