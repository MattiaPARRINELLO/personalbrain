import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getRpID, getOrigin, saveCredential } from "@/lib/auth";
import { consumeChallenge, createSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    response: unknown;
  };

  const challenge = await consumeChallenge();
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expire ou invalide" }, { status: 400 });
  }

  const rpID = getRpID(request);
  const origin = getOrigin(request);

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification echouee" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    await saveCredential({
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
    });

    await createSession("owner");

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Registration verification error:", error);
    return NextResponse.json({ error: "Verification echouee" }, { status: 400 });
  }
}
