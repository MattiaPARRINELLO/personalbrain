// dotenv est chargé dynamiquement dans le runtime node UNIQUEMENT : en import
// statique, il embarque fs/path/os/crypto dans le bundle edge de
// l'instrumentation, ce qui fait crasher le middleware edge
// ("__import_unsupported is not defined").
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("dotenv/config");
    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler();
  }
}
