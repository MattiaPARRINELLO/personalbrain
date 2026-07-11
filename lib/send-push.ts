import webpush from "web-push";

export function getVapidDetails() {
  const subject = process.env.VAPID_SUBJECT || "mailto:backstage@localhost";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  return { subject, publicKey, privateKey };
}

export function configureVapid() {
  const details = getVapidDetails();
  if (details.publicKey && details.privateKey) {
    webpush.setVapidDetails(details.subject, details.publicKey, details.privateKey);
  }
  return details;
}

export async function sendPushNotification(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: string
) {
  await webpush.sendNotification({ endpoint, keys }, payload);
}
