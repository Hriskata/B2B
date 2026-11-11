"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/form-parts";
import { Turnstile } from "@/components/turnstile";
import { DEFAULT_COUNTRY, ruleFor, type CountryOption } from "@/lib/company-number";
import { initialFormState, type FormState } from "@/lib/form-state";
import { PASSWORD_RULES_TEXT } from "@/lib/password-policy";
import { checkRegisterStepOneAction, registerAction } from "./actions";

// Step 1: the person and the login. Step 2: the company.
const STEP_ONE_FIELDS = ["fullName", "email", "password", "passwordConfirm"];

// One form for both steps: the step 1 inputs stay mounted (only hidden), so
// the final submit sends everything and the server checks it all again.
export function RegisterForm({
  siteKey,
  countries,
}: {
  siteKey: string;
  countries: CountryOption[];
}) {
  const [state, register, registering] = useActionState(registerAction, initialFormState);
  const [stepOneState, setStepOneState] = useState<FormState>(initialFormState);
  const [step, setStep] = useState<1 | 2>(1);
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [checking, startChecking] = useTransition();
  const [seenNonce, setSeenNonce] = useState(state.nonce);
  const formRef = useRef<HTMLFormElement>(null);

  // The final submit can still fail on a step 1 field: show it on step 1.
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    if (STEP_ONE_FIELDS.some((name) => state.fieldErrors?.[name])) {
      setStepOneState(state);
      setStep(1);
    }
  }

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  const rule = ruleFor(country);

  function checkStepOne() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    startChecking(async () => {
      const result = await checkRegisterStepOneAction(stepOneState, data);
      setStepOneState(result);
      if (result.status === "success") setStep(2);
    });
  }

  // Submitted without a form action, so React does not reset the inputs of
  // the hidden step.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      checkStepOne();
      return;
    }
    const data = new FormData(event.currentTarget);
    startTransition(() => register(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-secondary">
        {step === 1 ? "Стъпка 1 от 2: вашите данни" : "Стъпка 2 от 2: данни за фирмата"}
      </p>

      <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
        <FormMessage state={stepOneState} />
        <Field
          name="fullName"
          label="Име и фамилия"
          autoComplete="name"
          state={stepOneState}
          maxLength={120}
        />
        <Field
          name="email"
          label="Имейл"
          type="email"
          autoComplete="email"
          state={stepOneState}
          maxLength={254}
        />
        <Field
          name="password"
          label="Парола"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_RULES_TEXT}
          state={stepOneState}
          maxLength={128}
        />
        <Field
          name="passwordConfirm"
          label="Повторете паролата"
          type="password"
          autoComplete="new-password"
          state={stepOneState}
          maxLength={128}
        />
        <button type="submit" disabled={checking} className="btn btn-primary">
          {checking ? "Моля, изчакайте…" : "Напред"}
        </button>
      </div>

      <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
        <FormMessage state={state} />
        <div className="flex flex-col gap-1">
          <label htmlFor="f-country" className="font-medium">
            Държава, в която е регистрирана фирмата
          </label>
          <select
            id="f-country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            autoComplete="country"
            aria-invalid={state.fieldErrors?.country ? true : undefined}
            className="input"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.country && (
            <p role="alert" className="text-sm text-ember-300">
              {state.fieldErrors.country}
            </p>
          )}
        </div>
        <Field
          name="companyName"
          label="Име на фирмата"
          autoComplete="organization"
          state={state}
          maxLength={200}
        />
        {/* A new country means a new format: the field starts empty. */}
        <Field
          key={country}
          name="companyNumber"
          label={rule.label}
          inputMode={rule.kind === "eik" || rule.kind === "ein" ? "numeric" : "text"}
          hint={rule.hint}
          state={state}
          maxLength={rule.maxLength}
        />
        {step === 2 && <Turnstile siteKey={siteKey} resetKey={state.nonce} />}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
            Назад
          </button>
          <button type="submit" disabled={registering} className="btn btn-primary">
            {registering ? "Моля, изчакайте…" : "Регистрация"}
          </button>
        </div>
      </div>

      <p className="text-sm">
        Вече имате профил?{" "}
        <Link href="/login" className="underline">
          Вход
        </Link>
      </p>
    </form>
  );
}
