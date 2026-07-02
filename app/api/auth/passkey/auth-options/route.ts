import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getRpID, getUserStore } from "@/lib/auth";
import { createChallenge } from "@/lib/session";

export async function GET(request: Request) {
  const store = await getUserStore();

  if (store.credentials.length === 0) {
    return NextResponse.json(
      { error: "Aucune clee enregistree. Veuillez d'abord configurer Face ID / Touch ID." },
      { status: 403 }
    );
  }

  const rpID = getRpID(request);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: store.credentials.map((c) => ({
      id: c.id,
      type: "public-key" as const,
      transports: (c.transports as AuthenticatorTransport[]) ?? undefined,
    })),
    userVerification: "preferred",
  });

  await createChallenge(options.challenge);

  return NextResponse.json({ options });
}
