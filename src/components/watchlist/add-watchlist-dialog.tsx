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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SymbolSearchCombobox } from "@/components/watchlist/symbol-search-combobox";
import type { SymbolSearchHit } from "@/lib/market/types";

export function AddWatchlistDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<SymbolSearchHit | null>(null);
  const [notes, setNotes] = useState("");
  const router = useRouter();

  const reset = () => {
    setSelected(null);
    setNotes("");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || !selected.symbol) {
      toast.error("Pick a symbol from the search results");
      return;
    }
    const fd = new FormData();
    fd.set("symbol", selected.symbol);
    fd.set("exchange", selected.exchange);
    fd.set("notes", notes);
    start(async () => {
      const res = await addWatchlistItem(fd);
      if (res.ok) {
        toast.success("Added to watchlist");
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to add");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
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
          <div className="space-y-2">
            <Label>Symbol</Label>
            <SymbolSearchCombobox
              value={selected}
              onSelect={(hit) => setSelected(hit.symbol ? hit : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you watching this?"
            />
            <p className="text-xs text-muted-foreground">
              {notes.length} / 500
            </p>
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
            <Button
              type="submit"
              disabled={pending || !selected || !selected.symbol}
            >
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
