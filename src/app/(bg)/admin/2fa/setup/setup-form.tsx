"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { adminSetupAction } from "../../actions";

export function SetupForm({
  qrDataUrl,
  secret,
  finished = false,
}: {
  qrDataUrl: string;
  secret: string;
  finished?: boolean;
}) {
  const [state, action] = useActionState(adminSetupAction, initialFormState);

  if (finished && !state.recoveryCodes) {
    return (
      <p>
        Двуфакторната автентикация е включена.{" "}
        <Link href="/admin" className="underline">
          Към администрацията
        </Link>
      </p>
    );
  }

  if (state.status === "success" && state.recoveryCodes) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage state={state} />
        <p className="font-medium">
          Запазете тези кодове за възстановяване на сигурно място. Всеки важи
          само веднъж и повече няма да бъдат показани.
        </p>
        <ul className="grid grid-cols-1 gap-1 rounded-sm border border-line bg-card p-3 font-mono">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link href="/admin" className="underline">
          Продължи към администрацията
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p>
        Двуфакторната автентикация е задължителна за администраторите.
        Сканирайте кода с приложение за автентикация (например Google
        Authenticator или Aegis), после въведете показания 6-цифрен код.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, nothing to optimise */}
      <img
        src={qrDataUrl}
        alt="QR код за приложението за автентикация"
        width={220}
        height={220}
      />
      <p className="text-sm">
        Или въведете ключа ръчно:{" "}
        <span className="font-mono break-all">{secret}</span>
      </p>
      <FormMessage state={state} />
      <Field
        name="code"
        label="Код от приложението"
        inputMode="numeric"
        autoComplete="one-time-code"
        state={state}
        maxLength={8}
      />
      <SubmitButton>Включи 2FA</SubmitButton>
    </form>
  );
}
