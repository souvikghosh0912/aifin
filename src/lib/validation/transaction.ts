import { z } from "zod";

export const TransactionInputSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(40)
    .transform((s) => s.toUpperCase()),
  exchange: z.enum(["NSE", "BSE"]),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  price: z.coerce.number().nonnegative("Price cannot be negative"),
  fees: z.coerce.number().nonnegative().default(0),
  traded_at: z.string().min(1, "Trade date is required"),
  notes: z.string().max(500).optional(),
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
