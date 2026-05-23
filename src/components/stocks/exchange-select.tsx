"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Exchange } from "@/types/database";

interface Props {
  symbol: string;
  current: Exchange;
}

export function ExchangeSelect({ symbol, current }: Props) {
  const router = useRouter();
  return (
    <Select
      value={current}
      onValueChange={(next) => {
        router.replace(
          `/stocks/${encodeURIComponent(symbol)}?exchange=${next}`,
        );
      }}
    >
      <SelectTrigger className="h-6 w-[72px] gap-1 rounded border border-border px-2 py-0 text-xs font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NSE">NSE</SelectItem>
        <SelectItem value="BSE">BSE</SelectItem>
      </SelectContent>
    </Select>
  );
}
