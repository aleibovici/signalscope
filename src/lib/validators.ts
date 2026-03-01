import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const addPositionSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(10)
    .transform((s) => s.toUpperCase()),
  entryPrice: z.number().positive(),
  shares: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updatePositionSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  closePrice: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
  shares: z.number().positive().optional(),
}).refine(
  (data) => data.closePrice === undefined || data.status === "CLOSED",
  { message: "closePrice can only be set when status is CLOSED", path: ["closePrice"] }
);

export const symbolSchema = z
  .string()
  .min(1)
  .max(10)
  .transform((s) => s.toUpperCase());

export const symbolsQuerySchema = z
  .string()
  .transform((s) => s.split(",").map((sym) => sym.trim().toUpperCase()))
  .pipe(z.array(z.string().min(1).max(10)).min(1).max(50));

export const addWatchlistSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
});
