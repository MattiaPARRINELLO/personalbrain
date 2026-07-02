import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  CHALLENGE_COOKIE,
  SESSION_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
  signJwt,
  verifyJwt,
} from "./session-core";

export {
  SESSION_COOKIE,
  CHALLENGE_COOKIE,
  SESSION_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
  signJwt,
  verifyJwt,
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function createSession(userId: string): Promise<void> {
  const token = await signJwt({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyJwt<{ sub: string }>(token);
  if (!payload) return null;

  return { userId: payload.sub };
}

export async function createChallenge(challenge: string): Promise<void> {
  const token = await signJwt({
    challenge,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, token, {
    ...cookieOptions,
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export async function consumeChallenge(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyJwt<{ challenge: string }>(token);
  if (!payload) return null;

  cookieStore.set(CHALLENGE_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return payload.challenge;
}
