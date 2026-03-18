"use client";

import { forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatters";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const displayValue =
      value === "" || value === 0 ? "" : formatNumber(Number(value));

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        onChange(raw === "" ? 0 : parseInt(raw, 10));
      },
      [onChange]
    );

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-right ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          원
        </span>
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
