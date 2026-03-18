import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(num: number | string): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  return new Intl.NumberFormat("ko-KR").format(n);
}

export function formatPercent(rate: number | string): string {
  const n = typeof rate === "string" ? parseFloat(rate) : rate;
  return `${n.toFixed(2)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd HH:mm", { locale: ko });
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function formatResidentNumber(num: string): string {
  const cleaned = num.replace(/\D/g, "");
  if (cleaned.length >= 7) {
    return `${cleaned.slice(0, 6)}-${"*".repeat(7)}`;
  }
  return num;
}

export function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}
