import { query } from "./infra/db";
import { log } from "./infra/logger";

export function startApp(): void {
  log("app started");
  const rows = query("SELECT 1");
  log(`got ${rows.length} rows`);
}
