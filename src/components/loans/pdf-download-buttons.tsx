"use client";

import { FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PdfDownloadButtons({ loanId }: { loanId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          PDF 출력
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`/api/pdf/loan-contract/${loanId}`} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4 mr-2" />
            대출계약서
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/api/pdf/repayment-schedule/${loanId}`} target="_blank" rel="noopener noreferrer">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            상환스케줄표
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
