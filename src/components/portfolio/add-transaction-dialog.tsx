"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { addTransaction } from "@/app/(app)/transactions/actions";

export function AddTransactionDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addTransaction(fd);
      if (res.ok) {
        toast.success("Transaction added");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a transaction</DialogTitle>
          <DialogDescription>
            Record a buy or sell. Holdings update automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                name="symbol"
                placeholder="RELIANCE"
                required
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange">Exchange</Label>
              <Select name="exchange" defaultValue="NSE">
                <SelectTrigger id="exchange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="side">Side</Label>
              <Select name="side" defaultValue="BUY">
                <SelectTrigger id="side">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="traded_at">Date</Label>
              <Input
                id="traded_at"
                name="traded_at"
                type="date"
                defaultValue={today}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Qty</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="any"
                min="0"
                required
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="any"
                min="0"
                required
                placeholder="2500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees">Fees (₹)</Label>
              <Input
                id="fees"
                name="fees"
                type="number"
                step="any"
                min="0"
                defaultValue="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" maxLength={500} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
