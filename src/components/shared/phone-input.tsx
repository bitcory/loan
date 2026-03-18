"use client";

import { forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/[^0-9]/g, "");
        if (raw.length > 11) raw = raw.slice(0, 11);

        let formatted = raw;
        if (raw.length >= 8) {
          if (raw.length === 11) {
            formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
          } else if (raw.length === 10) {
            formatted = `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
          }
        } else if (raw.length >= 4) {
          formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
        }

        onChange(formatted);
      },
      [onChange]
    );

    return (
      <input
        ref={ref}
        type="tel"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={value}
        onChange={handleChange}
        placeholder="010-0000-0000"
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";
