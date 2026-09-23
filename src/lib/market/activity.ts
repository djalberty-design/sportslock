import { getSql } from "../db.ts";

export type ActivityType = "cron" | "engine" | "brain" | "access" | "override" | "suggestion" | "error";

/**
 * Log an activity event for the admin activity feed.
 * Safe to call from crons, server functions, etc.
 * Silently swallows errors to never break the caller.
 */
export async function logActivity(
  type: ActivityType,
  action: string,
  detail?: string,
  source = "system",
): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(
      `insert into desk_activity_log (type, action, detail, source)
       values ($1, $2, $3, $4)`,
      [type, action, detail || "", source],
    );
  } catch {
    // Never fail the caller
  }
}
