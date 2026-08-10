import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getRpID, getOrigin, saveCredential, hasCredentials, markSetupConsumed } from "@/lib/auth";
import { consumeChallenge, createSession, getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    response: unknown;
    setupToken?: string;
  };

  // Même garde que register-options : l'ajout d'une passkey à un compte déjà
  // configuré exige une session active (anti prise de contrôle).
  const alreadyRegistered = await hasCredentials();
  if (alreadyRegistered) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
  } else if (process.env.SETUP_TOKEN) {
    if (body.setupToken !== process.env.SETUP_TOKEN) {
      return NextResponse.json(
        { error: "Bootstrap protégé : le token de configuration est requis ou invalide." },
        { status: 403 }
      );
    }
  } else {
    console.warn(
      "[passkey] SETUP_TOKEN non défini : le premier enregistrement passkey est ouvert à tous. " +
      "Définissez SETUP_TOKEN avant d'exposer l'app à l'internet."
    );
  }

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

    // Consomme le SETUP_TOKEN : le bootstrap est clos dès le premier passkey.
    if (!alreadyRegistered) {
      await markSetupConsumed().catch((err) => {
        console.error("[passkey] Échec marquage setup consommé:", err);
      });
    }

    await createSession("owner");

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Registration verification error:", error);
    return NextResponse.json({ error: "Verification echouee" }, { status: 400 });
  }
}
