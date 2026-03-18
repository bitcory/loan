import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * 일수 기반 이자 계산
 * 일일이자 = 원금 × (연이율 / 365)
 */
export function calculateDailyInterest(
  principal: Decimal | number | string,
  annualRate: Decimal | number | string
): Decimal {
  const p = new Decimal(principal);
  const r = new Decimal(annualRate).div(100);
  return p.mul(r).div(365).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/**
 * 기간 이자 계산 (일수 기반)
 */
export function calculateInterestForDays(
  principal: Decimal | number | string,
  annualRate: Decimal | number | string,
  days: number
): Decimal {
  const p = new Decimal(principal);
  const r = new Decimal(annualRate).div(100);
  return p.mul(r).mul(days).div(365).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/**
 * 월 이자 계산 (일수 기반)
 */
export function calculateMonthlyInterest(
  principal: Decimal | number | string,
  annualRate: Decimal | number | string,
  fromDate: Date,
  toDate: Date
): Decimal {
  const days = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return calculateInterestForDays(principal, annualRate, days);
}

/**
 * 원리금균등분할상환 월 납입액 계산
 * PMT = P * r * (1+r)^n / ((1+r)^n - 1)
 * 여기서 r = 월이율 = 연이율/12
 */
export function calculateEqualPayment(
  principal: Decimal | number | string,
  annualRate: Decimal | number | string,
  termMonths: number
): Decimal {
  const P = new Decimal(principal);
  const monthlyRate = new Decimal(annualRate).div(100).div(12);

  if (monthlyRate.isZero()) {
    return P.div(termMonths).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }

  const onePlusR = monthlyRate.plus(1);
  const onePlusRn = onePlusR.pow(termMonths);
  const pmt = P.mul(monthlyRate).mul(onePlusRn).div(onePlusRn.minus(1));
  return pmt.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}
