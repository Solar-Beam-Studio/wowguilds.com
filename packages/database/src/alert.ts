export async function sendAlert(opts: {
  title: string;
  message: string;
  level: "error" | "warning" | "info" | "success";
  source: string;
  emoji?: string;
}) {
  const url = process.env.ZENHOOK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch {
    // Alert system should never crash the app
  }
}
