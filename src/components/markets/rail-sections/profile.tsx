"use client";

import { Copy, Minus } from "lucide-react";

import { PROFILE_ROWS } from "@/lib/market/profile-rows";

export function Profile() {
  return (
    <section className="border-t px-3 py-3">
      <h3 className="text-[13px] font-semibold text-foreground">Profile</h3>
      <ul className="mt-2 flex flex-col">
        {PROFILE_ROWS.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between py-1.5 text-[12px]"
          >
            <span className="text-foreground">{row.label}</span>
            {row.value == null ? (
              <Minus
                className="h-3 w-3 text-muted-foreground"
                strokeWidth={2.5}
                aria-label="Not available"
              />
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="num font-semibold tabular-nums text-foreground">
                  {row.value}
                </span>
                {row.copyable ? (
                  <button
                    type="button"
                    aria-label={`Copy ${row.label}`}
                    className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                ) : null}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
