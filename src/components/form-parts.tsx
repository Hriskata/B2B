"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
    >
      {pending ? "Моля, изчакайте…" : children}
    </button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  hint?: string;
  state: FormState;
  required?: boolean;
  maxLength?: number;
};

export function Field({
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  hint,
  state,
  required = true,
  maxLength,
}: FieldProps) {
  const error = state.fieldErrors?.[name];
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        maxLength={maxLength}
        // Values come back only for non-secret fields (see FormState).
        defaultValue={type === "password" ? undefined : state.values?.[name]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="rounded border border-zinc-400 bg-background px-3 py-2"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-zinc-600 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded border border-red-700 px-3 py-2 text-red-700 dark:text-red-400"
          : "rounded border border-green-700 px-3 py-2 text-green-800 dark:text-green-400"
      }
    >
      {state.message}
    </p>
  );
}
