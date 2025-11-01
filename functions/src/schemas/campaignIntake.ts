import { z } from "zod";

export const CampaignIntake = z.object({
  name: z.string().min(2),
  objective: z.string().min(4),
  landingPageUrl: z.string().url().nullable().optional(),
  platforms: z
    .array(z.enum(["instagram", "tiktok", "youtube", "x", "twitch"]))
    .min(1),
  budgetCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().default("USD"),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  niches: z.array(z.string()).min(1),
  followerMin: z.number().int().min(0).nullable().optional(),
  followerMax: z.number().int().min(0).nullable().optional(),
  minEngagement: z.number().min(0).max(1).nullable().optional(),
  locations: z.array(z.string()).optional(),
  missing: z.array(z.string()).default([]),
  confirmed: z.boolean().default(false)
});

export type CampaignIntakeType = z.infer<typeof CampaignIntake>;
