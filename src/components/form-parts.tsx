"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
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
  // Initial value for edit forms; a value returned after an error wins.
  defaultValue?: string;
  disabled?: boolean;
  multiline?: boolean;
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
  defaultValue,
  disabled,
  multiline = false,
}: FieldProps) {
  const error = state.fieldErrors?.[name];
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={6}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          defaultValue={state.values?.[name] ?? defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className="input"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          // Values come back only for non-secret fields (see FormState).
          defaultValue={
            type === "password"
              ? undefined
              : (state.values?.[name] ?? defaultValue)
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className="input"
        />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-ember-300">
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
          ? "rounded-sm border border-line-ember bg-ember-900 px-3 py-2 text-ember-300"
          : "rounded-sm border border-line bg-card px-3 py-2"
      }
    >
      {state.message}
    </p>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
  disabled,
  state,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
  state: FormState;
}) {
  // After an error the submitted choice comes back in state.values.
  const checked = state.values ? state.values[name] === "on" : defaultChecked;
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={disabled}
      />
      {label}
    </label>
  );
}
