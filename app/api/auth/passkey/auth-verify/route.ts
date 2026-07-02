import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getRpID, getOrigin, getCredentialById, saveCredential } from "@/lib/auth";
import { consumeChallenge, createSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    response: {
      id: string;
      rawId: string;
      response: {
        authenticatorData: string;
        clientDataJSON: string;
        signature: string;
        userHandle?: string;
      };
      type: "public-key";
      clientExtensionResults?: unknown;
      authenticatorAttachment?: string;
    };
  };

  const challenge = await consumeChallenge();
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expire ou invalide" }, { status: 400 });
  }

  const credential = await getCredentialById(body.response.id);
  if (!credential) {
    return NextResponse.json({ error: "Clee inconnue" }, { status: 400 });
  }

  const rpID = getRpID(request);
  const origin = getOrigin(request);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json({ error: "Verification echouee" }, { status: 400 });
    }

    await saveCredential({
      ...credential,
      counter: verification.authenticationInfo.newCounter,
    });

    await createSession("owner");

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Authentication verification error:", error);
    return NextResponse.json({ error: "Verification echouee" }, { status: 400 });
  }
}
