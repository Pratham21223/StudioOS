import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id baseline (19 MiB, 2 iterations, 1 lane).
// `algorithm: 2` is Argon2id; @node-rs/argon2 declares it as an ambient const
// enum, which cannot be imported at runtime under isolatedModules.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
