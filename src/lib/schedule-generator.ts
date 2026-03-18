import Decimal from "decimal.js";
import { addMonths } from "date-fns";
import {
  calculateMonthlyInterest,
  calculateEqualPayment,
} from "./interest";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ScheduleItem {
  installmentNumber: number;
  dueDate: Date;
  principalAmount: Decimal;
  interestAmount: Decimal;
  totalAmount: Decimal;
  remainingBalance: Decimal;
}

/**
 * 만기일시상환 스케줄 생성
 * 매월 이자만 납부, 마지막 회차에 원금 일시 상환
 */
function generateBulletSchedule(
  principal: Decimal,
  annualRate: Decimal,
  startDate: Date,
  termMonths: number
): ScheduleItem[] {
  const schedules: ScheduleItem[] = [];
  let balance = new Decimal(principal);

  for (let i = 1; i <= termMonths; i++) {
    const prevDate = addMonths(startDate, i - 1);
    const dueDate = addMonths(startDate, i);
    const interest = calculateMonthlyInterest(balance, annualRate, prevDate, dueDate);
    const isLast = i === termMonths;
    const principalPayment = isLast ? balance : new Decimal(0);
    const remaining = balance.minus(principalPayment);

    schedules.push({
      installmentNumber: i,
      dueDate,
      principalAmount: principalPayment,
      interestAmount: interest,
      totalAmount: principalPayment.plus(interest),
      remainingBalance: remaining,
    });

    balance = remaining;
  }

  return schedules;
}

/**
 * 원금균등분할상환 스케줄 생성
 * 원금을 균등 분할, 이자는 잔액 기준
 */
function generateEqualPrincipalSchedule(
  principal: Decimal,
  annualRate: Decimal,
  startDate: Date,
  termMonths: number
): ScheduleItem[] {
  const schedules: ScheduleItem[] = [];
  const monthlyPrincipal = principal
    .div(termMonths)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  let balance = new Decimal(principal);

  for (let i = 1; i <= termMonths; i++) {
    const prevDate = addMonths(startDate, i - 1);
    const dueDate = addMonths(startDate, i);
    const interest = calculateMonthlyInterest(balance, annualRate, prevDate, dueDate);
    const isLast = i === termMonths;
    const principalPayment = isLast ? balance : monthlyPrincipal;
    const remaining = balance.minus(principalPayment);

    schedules.push({
      installmentNumber: i,
      dueDate,
      principalAmount: principalPayment,
      interestAmount: interest,
      totalAmount: principalPayment.plus(interest),
      remainingBalance: remaining.lessThan(0) ? new Decimal(0) : remaining,
    });

    balance = remaining.lessThan(0) ? new Decimal(0) : remaining;
  }

  return schedules;
}

/**
 * 원리금균등분할상환 스케줄 생성
 * 매월 동일 금액 납부 (원금+이자)
 */
function generateEqualPaymentSchedule(
  principal: Decimal,
  annualRate: Decimal,
  startDate: Date,
  termMonths: number
): ScheduleItem[] {
  const schedules: ScheduleItem[] = [];
  const monthlyPayment = calculateEqualPayment(principal, annualRate, termMonths);
  let balance = new Decimal(principal);

  for (let i = 1; i <= termMonths; i++) {
    const prevDate = addMonths(startDate, i - 1);
    const dueDate = addMonths(startDate, i);
    const interest = calculateMonthlyInterest(balance, annualRate, prevDate, dueDate);
    const isLast = i === termMonths;
    const principalPayment = isLast
      ? balance
      : monthlyPayment.minus(interest).lessThan(0)
        ? new Decimal(0)
        : monthlyPayment.minus(interest);
    const remaining = balance.minus(principalPayment);
    const total = isLast ? principalPayment.plus(interest) : monthlyPayment;

    schedules.push({
      installmentNumber: i,
      dueDate,
      principalAmount: principalPayment.toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
      interestAmount: interest,
      totalAmount: total,
      remainingBalance: remaining.lessThan(0) ? new Decimal(0) : remaining.toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
    });

    balance = remaining.lessThan(0) ? new Decimal(0) : remaining;
  }

  return schedules;
}

/**
 * 상환 스케줄 생성 (메인 함수)
 */
export function generateSchedule(
  principal: number | string,
  annualRate: number | string,
  repaymentType: string,
  startDate: Date,
  termMonths: number
): ScheduleItem[] {
  const p = new Decimal(principal);
  const r = new Decimal(annualRate);

  switch (repaymentType) {
    case "BULLET":
      return generateBulletSchedule(p, r, startDate, termMonths);
    case "EQUAL_PRINCIPAL":
      return generateEqualPrincipalSchedule(p, r, startDate, termMonths);
    case "EQUAL_PAYMENT":
      return generateEqualPaymentSchedule(p, r, startDate, termMonths);
    default:
      throw new Error(`Unknown repayment type: ${repaymentType}`);
  }
}
