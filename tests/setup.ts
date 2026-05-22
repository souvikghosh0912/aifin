import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` throws when imported outside a server bundle. Stub it so we
// can unit-test modules that pull it in (cache, rate-limit, nse).
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
