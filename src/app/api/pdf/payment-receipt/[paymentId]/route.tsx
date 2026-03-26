import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerKoreanFont } from "@/lib/pdf-font";
import { format } from "date-fns";

registerKoreanFont();

const styles = StyleSheet.create({
  page: { fontFamily: "NanumGothic", fontSize: 10, padding: 50, color: "#222" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#666", marginBottom: 28 },
  box: { border: "1 solid #333", padding: 16, marginBottom: 16 },
  row: { flexDirection: "row", marginBottom: 6 },
  label: { width: 130, color: "#555" },
  value: { flex: 1 },
  divider: { borderTop: "1 dashed #aaa", marginVertical: 12 },
  totalRow: { flexDirection: "row", marginTop: 8 },
  totalLabel: { width: 130, fontWeight: "bold" },
  totalValue: { flex: 1, fontWeight: "bold" },
  stamp: { marginTop: 32, textAlign: "right", color: "#888" },
  footer: { position: "absolute", bottom: 30, left: 50, right: 50, textAlign: "center", fontSize: 8, color: "#aaa" },
});

function fmt(n: { toString: () => string } | null | undefined): string {
  if (n == null) return "-";
  return Number(n.toString()).toLocaleString("ko-KR");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { paymentId } = await params;
  const db = getTenantClient(session.user.organizationId);

  const payment = await db.payment.findFirst({
    where: { id: paymentId },
    include: {
      loan: {
        include: { customer: true },
      },
    },
  });

  if (!payment) return new Response("Not found", { status: 404 });

  const loan = payment.loan;
  const remainingBalance = Number(loan.balance.toString());

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>수 납 영 수 증</Text>
        <Text style={styles.subtitle}>Receipt of Payment</Text>

        <View style={styles.box}>
          <View style={styles.row}><Text style={styles.label}>수납일</Text><Text style={styles.value}>{format(payment.paymentDate, "yyyy년 MM월 dd일")}</Text></View>
          <View style={styles.row}><Text style={styles.label}>대출번호</Text><Text style={styles.value}>{loan.loanNumber}</Text></View>
          <View style={styles.row}><Text style={styles.label}>차주명</Text><Text style={styles.value}>{loan.customer.name}</Text></View>
        </View>

        <View style={styles.box}>
          <Text style={{ fontWeight: "bold", marginBottom: 10 }}>수납 내역</Text>
          <View style={styles.row}><Text style={styles.label}>원금</Text><Text style={styles.value}>{fmt(payment.principalAmount)} 원</Text></View>
          <View style={styles.row}><Text style={styles.label}>이자</Text><Text style={styles.value}>{fmt(payment.interestAmount)} 원</Text></View>
          <View style={styles.row}><Text style={styles.label}>연체이자</Text><Text style={styles.value}>{fmt(payment.overdueAmount)} 원</Text></View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>합계 수납액</Text>
            <Text style={styles.totalValue}>{fmt(payment.totalAmount)} 원</Text>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={styles.label}>수납 후 잔액</Text>
            <Text style={styles.value}>{remainingBalance.toLocaleString("ko-KR")} 원</Text>
          </View>
          {payment.memo && (
            <View style={[styles.row, { marginTop: 4 }]}>
              <Text style={styles.label}>메모</Text>
              <Text style={styles.value}>{payment.memo}</Text>
            </View>
          )}
        </View>

        <Text style={styles.stamp}>위 금액을 정히 수납하였음을 확인합니다.</Text>
        <Text style={{ textAlign: "right", marginTop: 24, color: "#888" }}>발행일: {format(new Date(), "yyyy년 MM월 dd일")}</Text>

        <Text style={styles.footer}>대출관리 시스템 — {format(new Date(), "yyyy-MM-dd HH:mm")} 출력</Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${paymentId}.pdf"`,
    },
  });
}
