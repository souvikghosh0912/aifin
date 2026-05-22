"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatNumber } from "@/lib/utils";
import type { Tables } from "@/types/database";

import { deleteTransaction } from "@/app/(app)/transactions/actions";

type Transaction = Tables<"transactions">;

export function TransactionsTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click <span className="font-medium">Add transaction</span> to record
          your first trade.
        </p>
      </div>
    );
  }

  const onDelete = (id: string) => {
    if (!confirm("Delete this transaction? Holdings will recalculate.")) return;
    start(async () => {
      const res = await deleteTransaction(id);
      if (res.ok) {
        toast.success("Transaction deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Fees</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="num text-muted-foreground">
                {new Date(tx.traded_at).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tx.symbol}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {tx.exchange}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={tx.side === "BUY" ? "success" : "destructive"}
                  className="text-[10px]"
                >
                  {tx.side}
                </Badge>
              </TableCell>
              <TableCell className="num text-right">
                {formatNumber(tx.quantity)}
              </TableCell>
              <TableCell className="num text-right">
                {formatINR(tx.price)}
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {tx.fees ? formatINR(tx.fees) : "—"}
              </TableCell>
              <TableCell className="num text-right font-medium">
                {formatINR(tx.quantity * tx.price)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(tx.id)}
                  disabled={pending}
                  aria-label="Delete transaction"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
