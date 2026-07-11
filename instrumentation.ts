import "dotenv/config";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler();
  }
}
