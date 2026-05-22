import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

export function renderWithQuery(
  ui: ReactElement,
  options: RenderOptions & { client?: QueryClient } = {},
) {
  const { client = makeQueryClient(), ...rest } = options;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper, ...rest }) };
}
