import { sweepLedger } from "@/lib/market/sweeper";

/**
 * Manual sweep trigger for the ledger panel button.
 * Delegates to the same real sweeper the cron uses — no coin flips.
 */
export async function runSweeper() {
  return sweepLedger();
}