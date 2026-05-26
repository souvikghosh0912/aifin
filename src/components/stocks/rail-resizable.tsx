"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface Props {
  /** Main page content rendered to the left of the rail. */
  children: ReactNode;
  /** Optional mobile-only slot (e.g. SidebarToggle). Hidden on md+. */
  mobileRail?: ReactNode;
  /** Resizable top section (e.g. watchlist). */
  top: ReactNode;
  /** Resizable bottom section (e.g. selected-symbol details). */
  bottom: ReactNode;
  /** localStorage namespace for the saved width and split ratio. */
  storageKey: string;
  /** Extra classes for the outer wrapper (e.g. "space-y-4"). */
  className?: string;
}

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const DEFAULT_TOP_SHARE = 0.5;
const MIN_TOP_SHARE = 0.2;
const MAX_TOP_SHARE = 0.8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function readNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function RailResizable({
  children,
  mobileRail,
  top,
  bottom,
  storageKey,
  className,
}: Props) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [topShare, setTopShare] = useState(DEFAULT_TOP_SHARE);
  const hydratedRef = useRef(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWidth(
      clamp(readNumber(`${storageKey}:width`, DEFAULT_WIDTH), MIN_WIDTH, MAX_WIDTH),
    );
    setTopShare(
      clamp(
        readNumber(`${storageKey}:topShare`, DEFAULT_TOP_SHARE),
        MIN_TOP_SHARE,
        MAX_TOP_SHARE,
      ),
    );
    hydratedRef.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(`${storageKey}:width`, String(width));
      window.localStorage.setItem(`${storageKey}:topShare`, String(topShare));
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [storageKey, width, topShare]);

  const startHorizontalDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: PointerEvent) => {
        // Dragging leftward (smaller clientX) expands the rail.
        setWidth(clamp(startW + (startX - ev.clientX), MIN_WIDTH, MAX_WIDTH));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    },
    [width],
  );

  const startVerticalDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const host = splitRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.height <= 0) return;
      const startY = e.clientY;
      const startShare = topShare;
      const total = rect.height;
      const onMove = (ev: PointerEvent) => {
        setTopShare(
          clamp(
            startShare + (ev.clientY - startY) / total,
            MIN_TOP_SHARE,
            MAX_TOP_SHARE,
          ),
        );
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";
    },
    [topShare],
  );

  return (
    <div
      style={{ "--rail-w": `${width}px` } as CSSProperties}
      className={cn("md:pr-[var(--rail-w)]", className)}
    >
      {mobileRail}
      {children}
      <aside
        style={{ width: "var(--rail-w)" }}
        className="hidden md:fixed md:bottom-0 md:right-0 md:top-12 md:z-20 md:flex md:flex-col md:overflow-hidden md:border-l md:bg-background"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize rail width"
          onPointerDown={startHorizontalDrag}
          style={{ WebkitTapHighlightColor: "transparent" }}
          className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-ew-resize touch-none transition-colors hover:bg-foreground/20 active:bg-foreground/30"
        />
        <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
          <div
            style={{ flex: `${topShare} 1 0` }}
            className="flex min-h-0 flex-col overflow-hidden"
          >
            {top}
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize rail split"
            onPointerDown={startVerticalDrag}
            style={{ WebkitTapHighlightColor: "transparent" }}
            className="relative h-px shrink-0 cursor-ns-resize touch-none bg-border transition-colors hover:bg-foreground/40 active:bg-foreground/60"
          >
            <span aria-hidden className="absolute inset-x-0 -inset-y-1" />
          </div>
          <div
            style={{ flex: `${1 - topShare} 1 0` }}
            className="flex min-h-0 flex-col overflow-hidden"
          >
            {bottom}
          </div>
        </div>
      </aside>
    </div>
  );
}
