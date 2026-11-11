// One company register behind one interface, so the provider can be changed
// in one module (CLAUDE.md: CompanyVerifier).

// What a register says about an EIK. certain: false means the register did
// not find it, but it is not confirmed that this answer really means "no such
// company" (e.g. a 404 whose meaning is not verified yet): then the
// registration goes to manual review instead of being refused. A technical
// failure is thrown as an Error (RegisterHttpError for HTTP answers).
export type RegistryAnswer =
  | { found: true; status: string | null; name: string | null }
  | { found: false; certain: boolean };

export interface CompanyVerifier {
  // Short id, also the key of its status table (status.ts).
  readonly provider: string;
  lookup(eik: string, signal: AbortSignal): Promise<RegistryAnswer>;
}

// An HTTP answer that is not usable. The status code is not secret and is
// logged; the URL, headers and body never are.
export class RegisterHttpError extends Error {
  constructor(readonly status: number) {
    super(`Company register answered ${status}`);
    this.name = "RegisterHttpError";
  }
}

// The result the registration acts on. not_confirmed: the register did not
// find the company, but that answer is not confirmed to mean "no such
// company" (manual review, never a refusal).
export type CompanyCheck =
  | { kind: "active" | "inactive" | "unknown"; status: string | null; name: string | null }
  | { kind: "not_found" | "not_confirmed" }
  // No answer after the retries, or no register configured.
  | { kind: "unavailable" };
