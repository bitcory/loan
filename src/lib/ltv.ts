import Decimal from "decimal.js";

interface LTVInput {
  appraisalValue: number | string; // 감정가
  existingMortgages: number | string; // 기존 근저당 합계
  depositAmount?: number | string; // 전세보증금
  newLoanAmount: number | string; // 신규 대출금
}

/**
 * LTV 계산
 * LTV = (기존 근저당 + 전세보증금 + 신규대출) / 감정평가액 × 100
 */
export function calculateLTV(input: LTVInput): Decimal {
  const appraisal = new Decimal(input.appraisalValue);
  if (appraisal.isZero()) return new Decimal(0);

  const existing = new Decimal(input.existingMortgages);
  const deposit = new Decimal(input.depositAmount || 0);
  const newLoan = new Decimal(input.newLoanAmount);

  const totalDebt = existing.plus(deposit).plus(newLoan);
  return totalDebt.div(appraisal).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * LTV 기준으로 최대 대출 가능 금액 계산
 */
export function calculateMaxLoanByLTV(
  appraisalValue: number | string,
  existingMortgages: number | string,
  depositAmount: number | string,
  maxLTVPercent: number | string
): Decimal {
  const appraisal = new Decimal(appraisalValue);
  const maxLTV = new Decimal(maxLTVPercent).div(100);
  const existing = new Decimal(existingMortgages);
  const deposit = new Decimal(depositAmount || 0);

  const maxTotal = appraisal.mul(maxLTV);
  const available = maxTotal.minus(existing).minus(deposit);

  return available.lessThan(0) ? new Decimal(0) : available.toDecimalPlaces(0, Decimal.ROUND_DOWN);
}
