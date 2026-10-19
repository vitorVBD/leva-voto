"use client";

import { forwardRef, useId, type ComponentProps } from "react";

const control =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 text-[17px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary min-h-12";

export const TextField = forwardRef<
  HTMLInputElement,
  ComponentProps<"input"> & { label: string; error?: string }
>(function TextField({ label, error, id, ...props }, ref) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-[15px] font-bold text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-erro` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-erro`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  ComponentProps<"select"> & { label: string; error?: string }
>(function SelectField({ label, error, id, children, ...props }, ref) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-[15px] font-bold text-foreground">
        {label}
      </label>
      <select
        ref={ref}
        id={fieldId}
        className={control}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export function Choice({
  name,
  checked,
  onChange,
  label,
  description,
  disabled,
  reason,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  reason?: string;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 text-foreground ${checked ? "border-primary" : "border-border"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 size-6 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <span>
        <span className="block text-base font-bold">{label}</span>
        {description ? <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span> : null}
        {disabled && reason ? <span className="mt-1 block text-sm leading-5 text-warn">{reason}</span> : null}
      </span>
    </label>
  );
}

export function CheckChoice({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 ${checked ? "border-primary" : "border-border"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-6 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <span>
        <span className="block text-base font-bold">{label}</span>
        {description ? <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}
