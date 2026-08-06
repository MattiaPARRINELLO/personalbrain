import { NextResponse } from "next/server";
import { getVapidDetails } from "@/lib/send-push";

// Clé publique VAPID (non secrète) servie au service worker pour permettre
// la rotation sans rebuild : le SW la récupère avant chaque (re)souscription.
export async function GET() {
  const { publicKey } = getVapidDetails();
  if (!publicKey) {
    return NextResponse.json({ error: "Clé VAPID non configurée" }, { status: 500 });
  }
  return NextResponse.json({ key: publicKey });
}
