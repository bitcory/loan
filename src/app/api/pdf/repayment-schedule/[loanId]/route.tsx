import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerKoreanFont } from "@/lib/pdf-font";
import { format } from "date-fns";

registerKoreanFont();

const styles = StyleSheet.create({
  page: { fontFamily: "NanumGothic", fontSize: 9, padding: 36, color: "#222" },
  title: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  meta: { flexDirection: "row", gap: 24, marginBottom: 16, fontSize: 9 },
  table: { borderTop: "1 solid #555", borderLeft: "1 solid #555" },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f5" },
  tr: { flexDirection: "row", borderBottom: "1 solid #ddd" },
  th: { borderRight: "1 solid #555", borderBottom: "1 solid #555", padding: "4 6", fontWeight: "bold", textAlign: "center" },
  td: { borderRight: "1 solid #ddd", padding: "3 6", textAlign: "right" },
  tdCenter: { borderRight: "1 solid #ddd", padding: "3 6", textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", fontSize: 7, color: "#aaa" },
});

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "예정", PAID: "완료", OVERDUE: "연체", PARTIAL: "부분"
};

function fmt(n: { toString: () => string } | null | undefined): string {
  if (n == null) return "-";
  return Number(n.toString()).toLocaleString("ko-KR");
}

const COL_WIDTHS = [28, 60, 60, 60, 60, 50, 40];

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
    include: {
      customer: true,
      schedules: { orderBy: { installmentNumber: "asc" } },
    },
  });

  if (!loan) return new Response("Not found", { status: 404 });

  const headers = ["회차", "납입일", "원금", "이자", "합계", "납부금액", "상태"];

  const doc = (
    <Document>
      <Page size="A4" style={styles.page} orientation="portrait">
        <Text style={styles.title}>상 환 스 케 줄 표</Text>

        <View style={styles.meta}>
          <Text>대출번호: {loan.loanNumber}</Text>
          <Text>차주: {loan.customer.name}</Text>
          <Text>대출금액: {fmt(loan.loanAmount)}원</Text>
          <Text>연이율: {loan.interestRate.toString()}%</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            {headers.map((h, i) => (
              <Text key={h} style={[styles.th, { width: COL_WIDTHS[i] }]}>{h}</Text>
            ))}
          </View>
          {loan.schedules.map((s) => (
            <View key={s.id} style={styles.tr}>
              <Text style={[styles.tdCenter, { width: COL_WIDTHS[0] }]}>{s.installmentNumber}</Text>
              <Text style={[styles.tdCenter, { width: COL_WIDTHS[1] }]}>{format(s.dueDate, "yyyy-MM-dd")}</Text>
              <Text style={[styles.td, { width: COL_WIDTHS[2] }]}>{fmt(s.principalAmount)}</Text>
              <Text style={[styles.td, { width: COL_WIDTHS[3] }]}>{fmt(s.interestAmount)}</Text>
              <Text style={[styles.td, { width: COL_WIDTHS[4] }]}>{fmt(s.totalAmount)}</Text>
              <Text style={[styles.td, { width: COL_WIDTHS[5] }]}>{fmt(s.paidAmount)}</Text>
              <Text style={[styles.tdCenter, { width: COL_WIDTHS[6] }]}>{STATUS_LABEL[s.status] || s.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>대출관리 시스템 — {format(new Date(), "yyyy-MM-dd HH:mm")} 출력</Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="repayment-schedule-${loan.loanNumber}.pdf"`,
    },
  });
}
