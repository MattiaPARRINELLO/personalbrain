import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getRpID, getOrigin, hasCredentials } from "@/lib/auth";
import { createChallenge, getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const alreadyRegistered = await hasCredentials();

  // Bootstrap : le premier enregistrement est libre (aucun compte n'existe).
  // Un enregistrement supplémentaire (ajout d'une passkey) exige une session
  // active, sinon n'importe qui peut enregistrer sa propre passkey et
  // s'authentifier à la place du propriétaire.
  if (alreadyRegistered) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
  } else if (process.env.SETUP_TOKEN) {
    // Premier setup exposé à l'internet : exiger un token de bootstrap
    // one-time (défini via SETUP_TOKEN) pour empêcher qu'un attaquant
    // s'enregistre comme propriétaire avant l'installation.
    const provided = request.headers.get("x-setup-token");
    if (provided !== process.env.SETUP_TOKEN) {
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

  const rpID = getRpID(request);
  const origin = getOrigin(request);

  const options = await generateRegistrationOptions({
    rpName: "BACKSTAGE",
    rpID,
    userID: new TextEncoder().encode("owner"),
    userName: "owner",
    userDisplayName: "Proprietaire",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await createChallenge(options.challenge);

  return NextResponse.json({
    options,
    origin,
    isFirstRegistration: !alreadyRegistered,
  });
}
