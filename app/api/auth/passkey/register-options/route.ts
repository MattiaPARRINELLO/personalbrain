import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getRpID, getOrigin, hasCredentials } from "@/lib/auth";
import { createChallenge } from "@/lib/session";

export async function GET(request: Request) {
  const alreadyRegistered = await hasCredentials();

  const rpID = getRpID(request);
  const origin = getOrigin(request);

  const options = await generateRegistrationOptions({
    rpName: "PersonalBrain",
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
