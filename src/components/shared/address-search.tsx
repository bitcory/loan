"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        width: string;
        height: string;
      }) => { embed: (element: HTMLElement) => void };
    };
  }
}

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: string;
}

interface AddressSearchProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function AddressSearch({ value, onChange, placeholder = "주소 검색", required }: AddressSearchProps) {
  const [open, setOpen] = useState(false);
  const embedRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    if (document.getElementById("daum-postcode-script")) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement("script");
    script.id = "daum-postcode-script";
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.onload = () => { scriptLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  function handleSearch() {
    setOpen(true);
    // 스크립트 로드 후 실행
    const tryEmbed = () => {
      if (!window.daum || !embedRef.current) {
        setTimeout(tryEmbed, 100);
        return;
      }
      new window.daum.Postcode({
        oncomplete(data: DaumPostcodeData) {
          const addr = data.roadAddress || data.jibunAddress;
          const building = data.buildingName ? ` (${data.buildingName})` : "";
          onChange(`${addr}${building}`);
          setOpen(false);
        },
        width: "100%",
        height: "100%",
      }).embed(embedRef.current);
    };
    setTimeout(tryEmbed, 50);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          readOnly
          placeholder={placeholder}
          required={required}
          className="flex-1 cursor-pointer bg-muted/30"
          onClick={handleSearch}
        />
        <Button type="button" variant="outline" onClick={handleSearch} className="shrink-0">
          <Search className="h-4 w-4 mr-1" />
          주소 검색
        </Button>
      </div>
      {open && (
        <div className="relative border rounded-md overflow-hidden" style={{ height: 400 }}>
          <div ref={embedRef} style={{ width: "100%", height: "100%" }} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 bg-background border rounded-md px-2 py-1 text-xs hover:bg-muted"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
