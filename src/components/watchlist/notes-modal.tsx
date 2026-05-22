"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateWatchlistNotes } from "@/app/(app)/watchlist/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/types/database";

type WatchlistItem = Tables<"watchlist_items">;

interface Props {
  item: WatchlistItem | null;
  onClose: () => void;
}

type Mode = "view" | "edit" | "confirm-delete";

export function NotesModal({ item, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (item) {
      setMode("view");
      setDraft(item.notes ?? "");
    }
  }, [item]);

  if (!item) return null;

  const save = (next: string | null) => {
    start(async () => {
      const res = await updateWatchlistNotes(item.id, next);
      if (res.ok) {
        toast.success(next == null ? "Note deleted" : "Note saved");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Notes — {item.symbol} ({item.exchange})
          </DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <p className="whitespace-pre-wrap text-sm">
            {item.notes ?? (
              <span className="text-muted-foreground">No notes yet.</span>
            )}
          </p>
        ) : null}

        {mode === "edit" ? (
          <div className="space-y-2">
            <Textarea
              rows={5}
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{draft.length} / 500</p>
          </div>
        ) : null}

        {mode === "confirm-delete" ? (
          <p className="text-sm">Delete this note? This cannot be undone.</p>
        ) : null}

        <DialogFooter>
          {mode === "view" ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Close
              </Button>
              {item.notes != null ? (
                <Button
                  variant="destructive"
                  onClick={() => setMode("confirm-delete")}
                  disabled={pending}
                >
                  Delete
                </Button>
              ) : null}
              <Button onClick={() => setMode("edit")} disabled={pending}>
                Edit
              </Button>
            </>
          ) : null}

          {mode === "edit" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(item.notes ?? "");
                  setMode("view");
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => save(draft.trim() === "" ? null : draft.trim())}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : null}

          {mode === "confirm-delete" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setMode("view")}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => save(null)}
                disabled={pending}
                aria-label="confirm delete"
              >
                {pending ? "Deleting…" : "Confirm delete"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
