"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addWatchlistItem } from "@/app/(app)/watchlist/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

export function AddWatchlistDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addWatchlistItem(fd);
      if (res.ok) {
        toast.success("Added to watchlist");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to add");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add symbol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to watchlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                name="symbol"
                placeholder="INFY"
                required
                autoCapitalize="characters"
                autoComplete="off"
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
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
