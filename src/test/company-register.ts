import type { CompanyVerifier, RegistryAnswer } from "@/lib/company-check/types";

// Fake company register for the tests (no request ever leaves the machine).
// Every EIK is an active company unless a test says otherwise.
type Answer = RegistryAnswer | "fail";

export const companyRegister = {
  configured: true,
  defaultAnswer: { found: true, status: "ACTIVE", name: "Тест ЕООД" } as Answer,
  answers: new Map<string, Answer>(),
  calls: [] as string[],
  reset() {
    this.configured = true;
    this.defaultAnswer = { found: true, status: "ACTIVE", name: "Тест ЕООД" };
    this.answers.clear();
    this.calls.length = 0;
  },
};

export const fakeVerifier: CompanyVerifier = {
  provider: "test",
  async lookup(eik) {
    companyRegister.calls.push(eik);
    const answer = companyRegister.answers.get(eik) ?? companyRegister.defaultAnswer;
    if (answer === "fail") throw new Error("register down");
    return answer;
  },
};
