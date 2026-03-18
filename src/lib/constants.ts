export const MAX_LEGAL_INTEREST_RATE = 20; // 법정 최고이율 20%

export const LOAN_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  OVERDUE: "OVERDUE",
  DEFAULT: "DEFAULT",
} as const;

export const REPAYMENT_TYPE = {
  BULLET: "BULLET", // 만기일시상환
  EQUAL_PRINCIPAL: "EQUAL_PRINCIPAL", // 원금균등분할상환
  EQUAL_PAYMENT: "EQUAL_PAYMENT", // 원리금균등분할상환
} as const;

export const REPAYMENT_TYPE_LABELS: Record<string, string> = {
  BULLET: "만기일시상환",
  EQUAL_PRINCIPAL: "원금균등분할상환",
  EQUAL_PAYMENT: "원리금균등분할상환",
};

export const COLLATERAL_TYPE = {
  APARTMENT: "APARTMENT",
  HOUSE: "HOUSE",
  LAND: "LAND",
  BUILDING: "BUILDING",
  OFFICETEL: "OFFICETEL",
  OTHER: "OTHER",
} as const;

export const COLLATERAL_TYPE_LABELS: Record<string, string> = {
  APARTMENT: "아파트",
  HOUSE: "주택",
  LAND: "토지",
  BUILDING: "건물",
  OFFICETEL: "오피스텔",
  OTHER: "기타",
};

export const OVERDUE_STAGE = {
  NORMAL: "NORMAL",
  STAGE_1: "STAGE_1", // 1~30일
  STAGE_2: "STAGE_2", // 31~90일
  STAGE_3: "STAGE_3", // 91일+
  BAD_DEBT: "BAD_DEBT", // 부실
} as const;

export const OVERDUE_STAGE_LABELS: Record<string, string> = {
  NORMAL: "정상",
  STAGE_1: "1단계 (1~30일)",
  STAGE_2: "2단계 (31~90일)",
  STAGE_3: "3단계 (91일+)",
  BAD_DEBT: "부실",
};

export const CUSTOMER_TYPE = {
  INDIVIDUAL: "INDIVIDUAL",
  CORPORATE: "CORPORATE",
} as const;

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "개인",
  CORPORATE: "법인",
};

export const PAYMENT_STATUS = {
  SCHEDULED: "SCHEDULED",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  PARTIAL: "PARTIAL",
} as const;
