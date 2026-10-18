import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Passwords are hashed with scrypt (built into Node, memory-hard, no native deps).
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>, so parameters can be
// raised later without breaking existing hashes.

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the email doesn't exist, so a failed login takes the same time
// either way and doesn't reveal which emails have accounts.
const DUMMY_HASH_PROMISE = hashPassword("dummy-password-for-timing");
export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY_HASH_PROMISE);
}
