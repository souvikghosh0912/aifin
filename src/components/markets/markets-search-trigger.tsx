"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { MarketsSearchDialog } from "@/components/markets/markets-search-dialog";
import { cn } from "@/lib/utils";

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function MarketsSearchTrigger() {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(isMac());
  }, []);

  // Capture-phase Cmd/Ctrl+K. stopImmediatePropagation prevents the
  // sidebar FindBar's bubble-phase listener (find-bar.tsx:159) from also
  // firing on /markets — markets owns the shortcut on this page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const cmdK =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "k";
      if (!cmdK) return;
      if (isEditableTarget(e.target) && !open) {
        // Pre-existing input focus shouldn't swallow the shortcut — fall
        // through and open anyway (TradingView behavior).
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen((v) => !v);
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <span className="ml-1 hidden items-center gap-0.5 sm:inline-flex">
          <kbd className="rounded border bg-background px-1 py-px font-mono text-[10px] text-muted-foreground">
            {mac ? "⌘" : "Ctrl"}
          </kbd>
          <kbd className="rounded border bg-background px-1 py-px font-mono text-[10px] text-muted-foreground">
            K
          </kbd>
        </span>
      </button>
      <MarketsSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
