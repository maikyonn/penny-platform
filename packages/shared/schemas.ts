import { z } from "zod";

// Profile schema
export const ProfileSchema = z.object({
  fullName: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  locale: z.string().default("en"),
  currentOrgId: z.string().nullable().optional(),
  createdAt: z.any(), // serverTimestamp
  updatedAt: z.any(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// Organization schema
export const OrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().nullable().optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).default("free"),
  billingStatus: z.enum(["active", "past_due", "paused", "canceled"]).default("active"),
  createdAt: z.any(),
  updatedAt: z.any(),
  deletedAt: z.any().nullable().optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

// Org member schema
export const OrgMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
  invitedBy: z.string().nullable().optional(),
  lastActiveAt: z.any().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});
export type OrgMember = z.infer<typeof OrgMemberSchema>;

// Campaign schema
export const CampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]).default("draft"),
  objective: z.string().nullable().optional(),
  budgetCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().default("USD"),
  landingPageUrl: z.string().url().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  createdBy: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
  archivedAt: z.any().nullable().optional(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// Campaign targets schema
export const CampaignTargetsSchema = z.object({
  audience: z.record(z.any()).default({}),
  geos: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  createdAt: z.any(),
});
export type CampaignTargets = z.infer<typeof CampaignTargetsSchema>;

// Influencer schema
export const InfluencerSchema = z.object({
  externalId: z.string().nullable().optional(),
  displayName: z.string(),
  handle: z.string(),
  email: z.string().email().nullable().optional(),
  platform: z.enum(["instagram", "tiktok", "youtube", "other"]),
  followerCount: z.number().int().nonnegative().default(0),
  engagementRate: z.number().nonnegative().default(0),
  location: z.string().nullable().optional(),
  languages: z.array(z.string()).default([]),
  verticals: z.array(z.string()).default([]),
  createdAt: z.any(),
  updatedAt: z.any(),
});
export type Influencer = z.infer<typeof InfluencerSchema>;

// Campaign influencer (pivot) schema
export const CampaignInfluencerSchema = z.object({
  influencerId: z.string(),
  status: z.enum(["prospect", "invited", "accepted", "declined", "in_conversation", "contracted", "completed"]).default("prospect"),
  source: z.enum(["manual", "search", "ai", "import"]).default("manual"),
  outreachChannel: z.enum(["email", "dm", "sms", "whatsapp", "other"]).default("email"),
  matchScore: z.number().min(0).max(1).nullable().optional(),
  lastMessageAt: z.any().nullable().optional(),
  denorm: z.object({
    displayName: z.string(),
    handle: z.string(),
    platform: z.string(),
    followerCount: z.number(),
  }).optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});
export type CampaignInfluencer = z.infer<typeof CampaignInfluencerSchema>;

// Outreach thread schema
export const OutreachThreadSchema = z.object({
  channel: z.enum(["email", "dm", "sms", "whatsapp", "other"]),
  externalThreadId: z.string().nullable().optional(),
  lastMessageAt: z.any().nullable().optional(),
  createdAt: z.any(),
});
export type OutreachThread = z.infer<typeof OutreachThreadSchema>;

// Outreach message schema
export const OutreachMessageSchema = z.object({
  direction: z.enum(["brand", "influencer", "system"]),
  body: z.string(),
  attachments: z.array(z.string()).default([]),
  sentAt: z.any(),
  authorId: z.string().nullable().optional(),
});
export type OutreachMessage = z.infer<typeof OutreachMessageSchema>;

// Subscription schema
export const SubscriptionSchema = z.object({
  provider: z.string().default("stripe"),
  customerId: z.string(),
  subscriptionId: z.string(),
  plan: z.enum(["starter", "pro", "enterprise"]),
  status: z.string(),
  currentPeriodEnd: z.any(),
  createdAt: z.any(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// Usage log schema
export const UsageLogSchema = z.object({
  metric: z.string(),
  quantity: z.number(),
  recordedAt: z.any(),
});
export type UsageLog = z.infer<typeof UsageLogSchema>;

