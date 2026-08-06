const args = process.argv.slice(2);
const job = args[0];

if (!job || !["reminders", "daily-brief"].includes(job)) {
  console.error("Usage: bun scripts/cron-scheduler.ts <reminders|daily-brief>");
  process.exit(1);
}

const BASE_URL = process.env.CRON_BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

async function main() {
  const url = `${BASE_URL}/api/cron/${job}`;

  console.log(`[cron] Appel ${url}...`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CRON_SECRET) {
    headers["x-cron-secret"] = CRON_SECRET;
  }

  const res = await fetch(url, { method: "POST", headers });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[cron] Échec HTTP ${res.status}: ${body}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`[cron] OK:`, data);
}

main().catch((err) => {
  console.error("[cron] Erreur:", err);
  process.exit(1);
});
