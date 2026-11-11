// One company register behind one interface, so the provider can be changed
// in one module (CLAUDE.md: CompanyVerifier).

// What a register says about an EIK. A technical failure (timeout, 5xx,
// unexpected answer) is thrown, not returned, so it can be retried.
export type RegistryAnswer =
  | { found: true; status: string | null; name: string | null }
  | { found: false };

export interface CompanyVerifier {
  // Short id, also the key of its status table (status.ts).
  readonly provider: string;
  lookup(eik: string, signal: AbortSignal): Promise<RegistryAnswer>;
}

// The result the registration acts on.
export type CompanyCheck =
  | { kind: "active" | "inactive" | "unknown"; status: string | null; name: string | null }
  | { kind: "not_found" }
  // No answer after the retries, or no register configured.
  | { kind: "unavailable" };
