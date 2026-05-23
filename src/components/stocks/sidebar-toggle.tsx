"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SidebarToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open stock rail"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-auto right-0 top-0 grid h-full w-[280px] max-w-full translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-3 rounded-none border-l p-3 sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stocks
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
