import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2, "이름은 2자 이상 입력해주세요"),
  customerType: z.enum(["INDIVIDUAL", "CORPORATE"]),
  residentNumber: z
    .string()
    .regex(/^\d{6}-?\d{7}$/, "주민등록번호 형식이 올바르지 않습니다")
    .optional()
    .or(z.literal("")),
  businessNumber: z
    .string()
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, "사업자등록번호 형식이 올바르지 않습니다")
    .optional()
    .or(z.literal("")),
  phone: z.string().min(10, "전화번호를 입력해주세요"),
  email: z.string().email("이메일 형식이 올바르지 않습니다").optional().or(z.literal("")),
  address: z.string().optional(),
  detailAddress: z.string().optional(),
  memo: z.string().optional(),
});

export const collateralSchema = z.object({
  customerId: z.string().min(1, "고객을 선택해주세요"),
  collateralType: z.enum([
    "APARTMENT",
    "HOUSE",
    "LAND",
    "BUILDING",
    "OFFICETEL",
    "OTHER",
  ]),
  address: z.string().min(1, "주소를 입력해주세요"),
  detailAddress: z.string().optional(),
  area: z.coerce.number().positive("면적을 입력해주세요"),
  appraisalValue: z.coerce.number().positive("감정가를 입력해주세요"),
  memo: z.string().optional(),
});

export const mortgageSchema = z.object({
  collateralId: z.string().min(1, "담보물건을 선택해주세요"),
  rank: z.coerce.number().int().positive("순위를 입력해주세요"),
  mortgageType: z.enum(["SENIOR", "JUNIOR"]), // 갑구/을구
  creditor: z.string().min(1, "채권자를 입력해주세요"),
  maxClaimAmount: z.coerce.number().positive("채권최고액을 입력해주세요"),
  loanAmount: z.coerce.number().nonnegative("대출금액을 입력해주세요").optional(),
  memo: z.string().optional(),
});

export const loanSchema = z.object({
  customerId: z.string().min(1, "고객을 선택해주세요"),
  collateralId: z.string().optional(),
  loanAmount: z.coerce.number().positive("대출금액을 입력해주세요"),
  interestRate: z.coerce
    .number()
    .positive("이율을 입력해주세요")
    .max(20, "법정 최고이율(20%)을 초과할 수 없습니다"),
  repaymentType: z.enum(["BULLET", "EQUAL_PRINCIPAL", "EQUAL_PAYMENT"]),
  loanTermMonths: z.coerce.number().int().positive("대출기간을 입력해주세요"),
  startDate: z.string().min(1, "실행일을 입력해주세요"),
  memo: z.string().optional(),
});

export const paymentSchema = z.object({
  loanId: z.string().min(1, "대출을 선택해주세요"),
  scheduleId: z.string().optional(),
  paymentDate: z.string().min(1, "납부일을 입력해주세요"),
  principalAmount: z.coerce.number().nonnegative("원금을 입력해주세요"),
  interestAmount: z.coerce.number().nonnegative("이자를 입력해주세요"),
  overdueAmount: z.coerce.number().nonnegative().optional(),
  memo: z.string().optional(),
});

export const extendLoanSchema = z.object({
  loanId: z.string().min(1, "대출을 선택해주세요"),
  newEndDate: z.string().min(1, "새 만기일을 입력해주세요"),
  newInterestRate: z.coerce
    .number()
    .positive("이율을 입력해주세요")
    .max(20, "법정 최고이율(20%)을 초과할 수 없습니다")
    .optional(),
  settleOverdueNow: z.boolean().default(true), // 연체이자 즉시 정산 여부
  memo: z.string().optional(),
});

export const prepaymentSchema = z.object({
  loanId: z.string().min(1, "대출을 선택해주세요"),
  prepaymentDate: z.string().min(1, "중도상환일을 입력해주세요"),
  prepaymentType: z.enum(["FULL", "PARTIAL"]), // 전액 / 일부
  prepaymentAmount: z.coerce.number().positive("상환금액을 입력해주세요").optional(),
  memo: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type CollateralFormData = z.infer<typeof collateralSchema>;
export type MortgageFormData = z.infer<typeof mortgageSchema>;
export type LoanFormData = z.infer<typeof loanSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type ExtendLoanFormData = z.infer<typeof extendLoanSchema>;
export type PrepaymentFormData = z.infer<typeof prepaymentSchema>;
