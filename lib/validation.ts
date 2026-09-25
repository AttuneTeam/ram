import { z } from "zod";
import { isValidDay } from "./dates";

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour");

export const workspaceInput = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  pin: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "PIN must be 4 digits")
    .optional(),
});

export const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  color: hexColor,
  unit: z
    .string()
    .trim()
    .max(16)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export const personInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
});

export const entryInput = z.object({
  categoryId: z.uuid(),
  personId: z
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  day: z.string().refine(isValidDay, "Invalid date"),
  description: z.string().trim().max(280).default(""),
  quantity: z
    .number()
    .nonnegative()
    .max(1_000_000)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const settingsInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  divider: z.enum(["none", "month", "year"]).optional(),
  weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
});
