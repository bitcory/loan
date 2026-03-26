import Decimal from "decimal.js";
import { differenceInDays, differenceInCalendarMonths } from "date-fns";
import { calculateInterestForDays } from "./interest";
import { generateSchedule, ScheduleItem } from "./schedule-generator";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Prisma Decimal 타입 (실제 Prisma 반환값)
interface PrismaDecimalLike {
  toString(): string;
}

// loan-calculator.ts가 받는 Loan 데이터 shape
export interface LoanForCalculation {
  balance: PrismaDecimalLike;
  interestRate: PrismaDecimalLike;
  prepaymentFeeRate: PrismaDecimalLike | null;
  repaymentType: string;
  startDate: Date;
  endDate: Date;
  loanTermMonths: number;
  schedules: ScheduleForCalculation[];
}

export interface ScheduleForCalculation {
  installmentNumber: number;
  dueDate: Date;
  totalAmount: PrismaDecimalLike;
  principalAmount: PrismaDecimalLike;
  remainingBalance: PrismaDecimalLike;
  paidAmount: PrismaDecimalLike;
  status: string;
}

export interface AccruedInterestResult {
  accruedInterest: Decimal;    // 경과이자
  prepaymentFee: Decimal;      // 중도상환수수료
  totalDue: Decimal;           // balance + 경과이자 + 수수료 (전액) 또는 amount + 경과이자 + 수수료 (일부)
  feeRate: Decimal;            // 실제 적용된 수수료율
}

export interface OverdueSettlementResult {
  totalOverdueInterest: Decimal;
  affectedScheduleIds: string[];
}

// ScheduleForCalculation with id for settlement tracking
export interface ScheduleForSettlement extends ScheduleForCalculation {
  id: string;
}

/**
 * 중도상환수수료 및 경과이자 계산 (LOAN-04, LOAN-05, LOAN-06, LOAN-07)
 *
 * @param loan - 대출 정보 (DB에서 schedules 포함하여 조회)
 * @param prepaymentAmount - 중도상환 원금액 (전액 = loan.balance, 일부 = 상환할 금액)
 * @param prepaymentDate - 중도상환 날짜
 * @param orgFeeRate - 조직 기본 수수료율 (Setting에서 조회, 없으면 null)
 * @param isFull - 전액 중도상환 여부
 */
export function calculatePrepaymentFee(
  loan: LoanForCalculation,
  prepaymentAmount: Decimal | number | string,
  prepaymentDate: Date,
  orgFeeRate: Decimal | number | string | null,
  isFull: boolean
): AccruedInterestResult {
  const balance = new Decimal(loan.balance.toString());
  const annualRate = new Decimal(loan.interestRate.toString());
  const payAmount = new Decimal(prepaymentAmount.toString());

  // 수수료율 우선순위: 대출별 > 조직별 > 0
  let feeRate = new Decimal(0);
  if (loan.prepaymentFeeRate !== null) {
    feeRate = new Decimal(loan.prepaymentFeeRate.toString());
  } else if (orgFeeRate !== null) {
    feeRate = new Decimal(orgFeeRate.toString());
  }

  // 경과이자 계산: 마지막 PAID 스케줄 dueDate(또는 startDate)부터 prepaymentDate까지
  const paidSchedules = loan.schedules
    .filter((s) => s.status === "PAID")
    .sort((a, b) => b.installmentNumber - a.installmentNumber);

  const interestFromDate =
    paidSchedules.length > 0 ? paidSchedules[0].dueDate : loan.startDate;

  const elapsedDays = differenceInDays(prepaymentDate, interestFromDate);
  const accruedInterest =
    elapsedDays > 0
      ? calculateInterestForDays(balance, annualRate, elapsedDays)
      : new Decimal(0);

  // 수수료 계산
  const feeBase = isFull ? balance : payAmount;
  const prepaymentFee = feeBase
    .mul(feeRate)
    .div(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  // 총 납부액
  const totalDue = (isFull ? balance : payAmount)
    .plus(accruedInterest)
    .plus(prepaymentFee);

  return { accruedInterest, prepaymentFee, totalDue, feeRate };
}

/**
 * 상환 스케줄 재계산 (LOAN-03, LOAN-05)
 * 미납(SCHEDULED) 스케줄을 교체할 새 스케줄 배열을 반환한다.
 * DB 쓰기는 호출 측(server action)에서 담당한다.
 *
 * @param loan - 대출 정보 (schedules 포함)
 * @param fromDate - 재계산 시작일 (연장일 또는 중도상환일)
 * @param newEndDate - 새 만기일 (없으면 기존 endDate 유지)
 * @param newRate - 새 이율 (없으면 기존 이율 유지)
 * @param newBalance - 재계산 기준 잔액 (일부상환 후 감소한 잔액, 없으면 loan.balance 유지)
 */
export function recalculateSchedule(
  loan: LoanForCalculation,
  fromDate: Date,
  newEndDate?: Date,
  newRate?: Decimal | number | string,
  newBalance?: Decimal | number | string
): ScheduleItem[] {
  const endDate = newEndDate ?? loan.endDate;
  const annualRate = newRate
    ? new Decimal(newRate.toString())
    : new Decimal(loan.interestRate.toString());
  const balance = newBalance
    ? new Decimal(newBalance.toString())
    : new Decimal(loan.balance.toString());

  // 재계산 기간 (개월수) — ceiling으로 처리하여 잔여 기간을 모두 포함
  const monthDiff = differenceInCalendarMonths(endDate, fromDate);
  const termMonths = Math.max(monthDiff, 1);

  // 시작 회차 번호: 기존 PAID/PARTIAL 스케줄 최대 installmentNumber + 1
  const paidInstallments = loan.schedules
    .filter((s) => s.status === "PAID" || s.status === "PARTIAL")
    .map((s) => s.installmentNumber);
  const startInstallmentNumber =
    paidInstallments.length > 0 ? Math.max(...paidInstallments) + 1 : 1;

  // generateSchedule은 1-based installmentNumber를 반환하므로 offset 적용
  const rawSchedule = generateSchedule(
    balance.toString(),
    annualRate.toString(),
    loan.repaymentType,
    fromDate,
    termMonths
  );

  // installmentNumber를 실제 회차로 조정
  return rawSchedule.map((item) => ({
    ...item,
    installmentNumber: item.installmentNumber + startInstallmentNumber - 1,
  }));
}

/**
 * 연체이자 정산 계산 (LOAN-02)
 * 연체 스케줄들의 총 연체이자를 계산한다.
 * 실제 Payment 생성 및 스케줄 상태 변경은 호출 측(server action)에서 담당한다.
 *
 * @param schedules - 대출의 스케줄 목록 (id 포함)
 * @param overdueRate - 연체이율 = 대출이율 + 연체가산이율 (%, e.g. 18)
 * @param settleDate - 정산 기준일
 */
export function settleOverdueInterest(
  schedules: ScheduleForSettlement[],
  overdueRate: Decimal | number | string,
  settleDate: Date
): OverdueSettlementResult {
  const rate = new Decimal(overdueRate.toString());
  let totalOverdueInterest = new Decimal(0);
  const affectedScheduleIds: string[] = [];

  const overdueSchedules = schedules.filter(
    (s) =>
      (s.status === "OVERDUE" || s.status === "PARTIAL" || s.status === "SCHEDULED") &&
      s.dueDate < settleDate
  );

  for (const schedule of overdueSchedules) {
    const overdueDays = differenceInDays(settleDate, schedule.dueDate);
    if (overdueDays <= 0) continue;

    // 잔여 미납금액 기준으로 연체이자 계산
    const unpaid = new Decimal(schedule.totalAmount.toString()).minus(
      new Decimal(schedule.paidAmount.toString())
    );
    if (unpaid.lessThanOrEqualTo(0)) continue;

    const overdueInterest = calculateInterestForDays(unpaid, rate, overdueDays);
    totalOverdueInterest = totalOverdueInterest.plus(overdueInterest);
    affectedScheduleIds.push(schedule.id);
  }

  return { totalOverdueInterest, affectedScheduleIds };
}
