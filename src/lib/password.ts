import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { validatePassword } from "./password-policy";

export { validatePassword };

// @node-rs/argon2 defaults to Argon2id with the library's recommended costs.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verified against when the account does not exist, so that "unknown email"
// and "wrong password" take about the same time.
let dummyHash: Promise<string> | undefined;

export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-only");
  await verifyPassword(await dummyHash, password);
}
