"use client";

import {
  ChevronRight,
  Copy,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

import type { CompanyProfile } from "@/lib/market/types";
import { cn } from "@/lib/utils";

interface Props {
  /** Display name shown in the heading (e.g. "HDFC Bank Limited"). */
  name: string;
  profile: CompanyProfile;
}

const IPO_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatIpoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? IPO_DATE_FMT.format(d) : null;
}

/**
 * "About" block that mirrors TradingView's company-profile layout. Rendered
 * after Key Stats on /stocks/[symbol]. Each cell falls back to an em-dash
 * when the upstream payload doesn't include the field, so missing data never
 * collapses the grid.
 */
export function AboutSection({ name, profile }: Props) {
  const ipoDate = formatIpoDate(profile.ipoDate);

  return (
    <section id="about" className="scroll-mt-20 space-y-5 pt-2">
      <h2 className="flex items-center gap-0.5 text-2xl font-extrabold tracking-tight text-foreground">
        <span>About {name}</span>
        <ChevronRight
          className="h-6 w-6 -translate-y-px text-foreground"
          strokeWidth={2.5}
          aria-hidden
        />
      </h2>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Sector" value={profile.sector} hasChevron />
        <Field label="Industry" value={profile.industry} hasChevron />
        <Field label="CEO" value={profile.ceo} />

        <WebsiteField website={profile.website} />
        <Field label="Headquarters" value={profile.headquarters} />
        <Field
          label="Founded"
          value={profile.founded != null ? String(profile.founded) : null}
        />

        <Field label="IPO date" value={ipoDate} />
        <IdentifiersField isin={profile.isin} />
        <CfiField code={profile.cfiCode} />
      </dl>

      {profile.description ? (
        <Description text={profile.description} />
      ) : null}
    </section>
  );
}

/* ---- field primitives ------------------------------------------------- */

function FieldShell({
  label,
  countBadge,
  children,
}: {
  label: string;
  countBadge?: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
        <span>{label}</span>
        {countBadge != null ? (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
            {countBadge}
          </span>
        ) : null}
      </dt>
      <dd className="mt-1 text-[17px] leading-tight">{children}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  hasChevron = false,
}: {
  label: string;
  value: string | null;
  hasChevron?: boolean;
}) {
  const missing = value == null || value.length === 0;
  return (
    <FieldShell label={label}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5",
          missing && "text-muted-foreground",
        )}
      >
        <span>{missing ? "—" : value}</span>
        {hasChevron && !missing ? (
          <ChevronRight
            className="h-4 w-4 text-foreground"
            strokeWidth={2.5}
            aria-hidden
          />
        ) : null}
      </span>
    </FieldShell>
  );
}

function WebsiteField({ website }: { website: string | null }) {
  if (!website) {
    return <Field label="Website" value={null} />;
  }
  return (
    <FieldShell label="Website">
      <a
        href={`https://${website}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 hover:underline"
      >
        <span>{website}</span>
        <ExternalLink
          className="h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
      </a>
    </FieldShell>
  );
}

function IdentifiersField({ isin }: { isin: string | null }) {
  // The grey "2" badge in the reference reflects how many identifiers a
  // company has in upstream registries (e.g. ISIN + CUSIP). We only surface
  // ISIN today, so the badge is shown only when we have a value.
  return (
    <FieldShell label="Identifiers" countBadge={isin ? 2 : null}>
      {isin ? (
        <span className="inline-flex items-center gap-1.5">
          <span>
            <span className="text-muted-foreground">ISIN</span>{" "}
            <span className="font-mono">{isin}</span>
          </span>
          <CopyButton value={isin} label="Copy ISIN" />
          <button
            type="button"
            aria-label="More identifiers"
            className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </FieldShell>
  );
}

function CfiField({ code }: { code: string | null }) {
  if (!code) {
    return <Field label="CFI code" value={null} />;
  }
  return (
    <FieldShell label="CFI code">
      <span className="inline-flex items-center gap-1.5">
        <a
          href="#"
          className="font-mono underline-offset-2 hover:underline"
          onClick={(e) => e.preventDefault()}
        >
          {code}
        </a>
        <CopyButton value={code} label="Copy CFI code" />
      </span>
    </FieldShell>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard API blocked — silent */
        }
      }}
      className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // ~290 chars ≈ three lines at the body font size + max-w-3xl. We truncate by
  // character count rather than `line-clamp` so the toggle stays visible
  // inline at the end of the visible text, matching the reference.
  const LIMIT = 290;
  const truncatable = text.length > LIMIT;
  const collapsed = !expanded && truncatable;
  const visible = collapsed ? text.slice(0, LIMIT).trimEnd() : text;

  return (
    <p className="max-w-3xl text-[15px] leading-relaxed text-foreground">
      <span>{visible}</span>
      {truncatable ? (
        <>
          {collapsed ? "… " : " "}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-semibold text-primary hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </>
      ) : null}
    </p>
  );
}
