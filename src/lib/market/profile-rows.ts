export interface ProfileRow {
  label: string;
  value: string | null;
  /** Render a copy-to-clipboard affordance next to the value. */
  copyable?: boolean;
}

/**
 * Static row template for the Profile section. Values are wired up to live
 * data once we have a profile source; until then every row renders the
 * empty-state dash. FIGI keeps the copy affordance so it's ready to ship.
 */
export const PROFILE_ROWS: ProfileRow[] = [
  { label: "Website", value: null },
  { label: "Employees (FY)", value: null },
  { label: "ISIN", value: null },
  { label: "CUSIP", value: null },
  { label: "FIGI", value: null, copyable: true },
];
