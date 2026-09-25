import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * The slug is the only thing standing between a PIN-less workspace and the
 * internet, so it must be unguessable: 14 chars over 57 symbols ≈ 82 bits.
 * Look-alike characters (0/O, 1/l/I) are left out so it survives being read aloud.
 */
export function generateSlug(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** After this many wrong PINs the workspace refuses attempts for LOCK_MINUTES. */
export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function accessCookieName(slug: string): string {
  return `ram_access_${slug}`;
}

/**
 * Proof that this browser entered the PIN. It is bound to the current PIN hash,
 * so changing or removing the PIN invalidates every cookie issued before.
 */
export function accessToken(slug: string, pinHash: string, secret: string): string {
  return createHmac("sha256", secret).update(`${slug}\n${pinHash}`).digest("base64url");
}

export function verifyAccessToken(
  token: string | undefined,
  slug: string,
  pinHash: string,
  secret: string,
): boolean {
  if (!token) return false;
  const expected = Buffer.from(accessToken(slug, pinHash, secret));
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
