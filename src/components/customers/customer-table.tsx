"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPhoneNumber } from "@/lib/formatters";
import { CUSTOMER_TYPE_LABELS } from "@/lib/constants";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  customerType: string;
  phone: string;
  email: string | null;
  createdAt: Date | string;
  _count: { loans: number };
}

export function CustomerTable({ customers }: { customers: Customer[] }) {
  const router = useRouter();

  if (customers.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>전화번호</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead className="text-center">대출</TableHead>
            <TableHead>등록일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              등록된 고객이 없습니다
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>고객번호</TableHead>
          <TableHead>이름</TableHead>
          <TableHead>유형</TableHead>
          <TableHead>전화번호</TableHead>
          <TableHead>이메일</TableHead>
          <TableHead className="text-center">대출</TableHead>
          <TableHead>등록일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/customers/${c.id}`)}
          >
            <TableCell className="font-mono text-muted-foreground">{c.customerNumber}</TableCell>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {CUSTOMER_TYPE_LABELS[c.customerType]}
              </Badge>
            </TableCell>
            <TableCell>{formatPhoneNumber(c.phone)}</TableCell>
            <TableCell>{c.email || "-"}</TableCell>
            <TableCell className="text-center">{c._count.loans}건</TableCell>
            <TableCell>{formatDate(c.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
