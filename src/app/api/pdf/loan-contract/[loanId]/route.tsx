import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerKoreanFont } from "@/lib/pdf-font";
import { format } from "date-fns";

registerKoreanFont();

const styles = StyleSheet.create({
  page: { fontFamily: "NanumGothic", fontSize: 10, padding: 40, color: "#222" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", borderBottom: "1 solid #888", paddingBottom: 4, marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 120, color: "#555" },
  value: { flex: 1 },
  notice: { marginTop: 24, fontSize: 9, color: "#555", borderTop: "1 solid #ccc", paddingTop: 12 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#aaa" },
});

function fmt(n: { toString: () => string } | null | undefined): string {
  if (n == null) return "-";
  return Number(n.toString()).toLocaleString("ko-KR");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { loanId } = await params;
  const db = getTenantClient(session.user.organizationId);

  const loan = await db.loan.findFirst({
    where: { id: loanId },
    include: { customer: true, collateral: true },
  });

  if (!loan) return new Response("Not found", { status: 404 });

  const repaymentTypeLabel: Record<string, string> = {
    BULLET: "만기일시",
    EQUAL_PRINCIPAL: "원금균등",
    EQUAL_PAYMENT: "원리금균등",
  };

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>대 출 계 약 서</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>차주 정보</Text>
          <View style={styles.row}><Text style={styles.label}>성명</Text><Text style={styles.value}>{loan.customer.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>연락처</Text><Text style={styles.value}>{loan.customer.phone || "-"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>주소</Text><Text style={styles.value}>{loan.customer.address || "-"}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>대출 조건</Text>
          <View style={styles.row}><Text style={styles.label}>대출번호</Text><Text style={styles.value}>{loan.loanNumber}</Text></View>
          <View style={styles.row}><Text style={styles.label}>대출금액</Text><Text style={styles.value}>{fmt(loan.loanAmount)}원</Text></View>
          <View style={styles.row}><Text style={styles.label}>연이율</Text><Text style={styles.value}>{loan.interestRate.toString()}%</Text></View>
          <View style={styles.row}><Text style={styles.label}>상환방식</Text><Text style={styles.value}>{repaymentTypeLabel[loan.repaymentType] || loan.repaymentType}</Text></View>
          <View style={styles.row}><Text style={styles.label}>대출기간</Text><Text style={styles.value}>{loan.loanTermMonths}개월</Text></View>
          <View style={styles.row}><Text style={styles.label}>대출일</Text><Text style={styles.value}>{format(loan.startDate, "yyyy년 MM월 dd일")}</Text></View>
          <View style={styles.row}><Text style={styles.label}>만기일</Text><Text style={styles.value}>{format(loan.endDate, "yyyy년 MM월 dd일")}</Text></View>
        </View>

        {loan.collateral && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>담보 정보</Text>
            <View style={styles.row}><Text style={styles.label}>담보 종류</Text><Text style={styles.value}>{loan.collateral.collateralType}</Text></View>
            <View style={styles.row}><Text style={styles.label}>주소</Text><Text style={styles.value}>{loan.collateral.address}</Text></View>
            <View style={styles.row}><Text style={styles.label}>평가액</Text><Text style={styles.value}>{fmt(loan.collateral.appraisalValue)}원</Text></View>
          </View>
        )}

        <View style={styles.notice}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>법정금리 고지</Text>
          <Text>본 대출의 이자율은 이자제한법 및 대부업법에서 정한 최고이자율(연 20%)을 초과하지 않습니다.</Text>
          <Text>중도상환 시 잔여기간에 따른 수수료가 부과될 수 있으며, 금융소비자보호법에 따른 최대 2%가 적용됩니다.</Text>
        </View>

        <View style={{ marginTop: 40 }}>
          <Text>위 내용에 동의하여 대출 계약을 체결합니다.</Text>
          <View style={{ marginTop: 20, flexDirection: "row", gap: 60 }}>
            <View><Text>차주: {loan.customer.name}  (인)</Text></View>
            <View><Text>대주: _______________  (인)</Text></View>
          </View>
          <Text style={{ marginTop: 8, color: "#888" }}>계약일: {format(new Date(), "yyyy년 MM월 dd일")}</Text>
        </View>

        <Text style={styles.footer}>대출관리 시스템 — {format(new Date(), "yyyy-MM-dd HH:mm")} 출력</Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="loan-contract-${loan.loanNumber}.pdf"`,
    },
  });
}
