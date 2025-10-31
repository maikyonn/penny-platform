import { z } from "zod";

const Timestamp = z.any();

const PlanStatusEnum = z.enum(["active", "trialing", "past_due", "canceled", "none"]);
const PlanTypeEnum = z.enum(["free", "pro", "enterprise", "none"]);
const OrgRoleEnum = z.enum(["owner", "admin", "member"]);
const CampaignStatusEnum = z.enum(["draft", "scheduled", "active", "paused", "completed", "archived"]);
const TargetStatusEnum = z.enum([
  "pending",
  "queued",
  "sending",
  "sent",
  "failed",
  "bounced",
  "replied",
  "opted_out",
  "skipped",
]);

const UsageSchema = z.object({
  emailDailyCap: z.number().int().nonnegative(),
  emailDailySent: z.number().int().nonnegative(),
  emailDailyResetAt: Timestamp,
});

const GmailMetadataSchema = z.object({
  connected: z.boolean(),
  emailAddress: z.string().email().nullable().optional(),
  gmailUserId: z.string().nullable().optional(),
  labelId: z.string().nullable().optional(),
  historyId: z.string().nullable().optional(),
  watchExpiration: Timestamp.nullable().optional(),
  lastSyncAt: Timestamp.nullable().optional(),
});

export const UserDocSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  photoURL: z.string().url().optional(),
  createdAt: Timestamp,
  orgId: z.string().nullable().optional(),
  roles: z
    .object({
      global: z.enum(["admin", "user"]).optional(),
      orgs: z.record(OrgRoleEnum).optional(),
    })
    .partial()
    .default({}),
  stripeCustomerId: z.string().nullable().optional(),
  plan: z.object({
    type: PlanTypeEnum,
    productId: z.string().nullable().optional(),
    priceId: z.string().nullable().optional(),
    status: PlanStatusEnum,
  }),
  gmail: GmailMetadataSchema,
  usage: UsageSchema,
  settings: z.record(z.unknown()).optional(),
  features: z.record(z.boolean()).optional(),
  legal: z
    .object({
      acceptedTermsAt: Timestamp.nullable().optional(),
      acceptedPrivacyAt: Timestamp.nullable().optional(),
    })
    .partial()
    .optional(),
  disabled: z.boolean().optional(),
  updatedAt: Timestamp,
});
export type UserDoc = z.infer<typeof UserDocSchema>;

export const OrgDocSchema = z.object({
  name: z.string().min(1),
  ownerUid: z.string(),
  stripeCustomerId: z.string().nullable().optional(),
  plan: z
    .object({
      type: PlanTypeEnum,
      productId: z.string().nullable().optional(),
      priceId: z.string().nullable().optional(),
      status: PlanStatusEnum,
    })
    .optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type OrgDoc = z.infer<typeof OrgDocSchema>;

export const OrgMemberDocSchema = z.object({
  role: OrgRoleEnum,
  joinedAt: Timestamp,
});
export type OrgMemberDoc = z.infer<typeof OrgMemberDocSchema>;

export const OrgInviteDocSchema = z.object({
  email: z.string().email(),
  role: OrgRoleEnum,
  status: z.enum(["pending", "accepted", "expired", "revoked"]),
  token: z.string(),
  createdAt: Timestamp,
  expiresAt: Timestamp,
});
export type OrgInviteDoc = z.infer<typeof OrgInviteDocSchema>;

const MetricsSchema = z
  .object({
    followers: z.number().int().nonnegative().optional(),
    avgLikes: z.number().nonnegative().optional(),
    avgComments: z.number().nonnegative().optional(),
    engagementRate: z.number().nonnegative().optional(),
  })
  .catchall(z.number().or(z.null()))
  .optional();

export const InfluencerDocSchema = z.object({
  platform: z.string(),
  handle: z.string(),
  displayName: z.string(),
  externalIds: z.record(z.string()).optional(),
  emails: z.array(z.string().email()).optional(),
  website: z.string().url().nullable().optional(),
  location: z.string().nullable().optional(),
  metrics: MetricsSchema,
  categories: z.array(z.string()).optional(),
  audience: z.record(z.unknown()).optional(),
  imageUrls: z.record(z.string().url()).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  doNotContact: z.boolean().default(false),
  unsubscribedAt: Timestamp.nullable().optional(),
  bounce: z.boolean().default(false),
  lastRefreshedAt: Timestamp.optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type InfluencerDoc = z.infer<typeof InfluencerDocSchema>;

export const SearchJobDocSchema = z.object({
  createdByUid: z.string(),
  orgId: z.string().nullable().optional(),
  query: z.record(z.unknown()),
  status: z.enum(["queued", "running", "succeeded", "failed", "canceled"]),
  stages: z.record(
    z.object({
      startedAt: Timestamp.nullable().optional(),
      durationMs: z.number().int().nonnegative().nullable().optional(),
      status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
      metrics: z.record(z.unknown()).optional(),
    }),
  ),
  brightdataJobId: z.string().nullable().optional(),
  resultSet: z
    .object({
      storageUri: z.string(),
      total: z.number().int().nonnegative(),
    })
    .optional(),
  cost: z
    .object({
      tokens: z.number().nonnegative(),
      usd: z.number().nonnegative(),
    })
    .optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type SearchJobDoc = z.infer<typeof SearchJobDocSchema>;

export const OutreachCampaignDocSchema = z.object({
  ownerUid: z.string(),
  orgId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  status: CampaignStatusEnum,
  channel: z.literal("email"),
  gmail: z
    .object({
      useUserGmail: z.literal(true),
      labelId: z.string().nullable().optional(),
      sendAs: z.string().nullable().optional(),
    })
    .optional(),
  template: z.object({
    subject: z.string(),
    bodyHtml: z.string(),
    bodyText: z.string().nullable().optional(),
    variables: z.array(z.string()),
  }),
  schedule: z.object({
    startAt: Timestamp.nullable().optional(),
    timezone: z.string(),
    dailyCap: z.number().int().positive(),
    batchSize: z.number().int().positive(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  }),
  throttle: z.object({
    perMinute: z.number().int().nonnegative(),
    perHour: z.number().int().nonnegative(),
  }),
  targetSource: z.record(z.unknown()).optional(),
  totals: z.object({
    pending: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    bounced: z.number().int().nonnegative(),
    replied: z.number().int().nonnegative(),
    optedOut: z.number().int().nonnegative(),
  }),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type OutreachCampaignDoc = z.infer<typeof OutreachCampaignDocSchema>;

export const CampaignTargetDocSchema = z.object({
  influencerId: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  status: TargetStatusEnum,
  failureReason: z.string().nullable().optional(),
  scheduledAt: Timestamp.nullable().optional(),
  sentAt: Timestamp.nullable().optional(),
  lastMessageAt: Timestamp.nullable().optional(),
  replyAt: Timestamp.nullable().optional(),
  gmailThreadId: z.string().nullable().optional(),
  lastGmailMessageId: z.string().nullable().optional(),
  messageCount: z.number().int().nonnegative().default(0),
  priority: z.number().int().nonnegative().default(0),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        storagePath: z.string(),
        size: z.number().int().nonnegative(),
        mimeType: z.string(),
      }),
    )
    .optional(),
  customFields: z.record(z.unknown()).optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type CampaignTargetDoc = z.infer<typeof CampaignTargetDocSchema>;

export const ThreadDocSchema = z.object({
  userId: z.string(),
  orgId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  influencerId: z.string().nullable().optional(),
  contactEmail: z.string().email(),
  gmailThreadId: z.string(),
  gmailLabelId: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  status: z.enum(["open", "closed"]),
  lastMessageAt: Timestamp,
  messagesCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type ThreadDoc = z.infer<typeof ThreadDocSchema>;

export const ThreadMessageDocSchema = z.object({
  direction: z.enum(["outgoing", "incoming"]),
  subject: z.string(),
  bodyHtml: z.string().nullable().optional(),
  bodyText: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  gmailMessageId: z.string(),
  sentAt: Timestamp,
  headers: z.record(z.unknown()).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        size: z.number().int().nonnegative(),
        mimeType: z.string(),
        storagePath: z.string(),
        gmailAttachmentId: z.string().optional(),
      }),
    )
    .optional(),
  tracking: z
    .object({
      opens: z.number().int().nonnegative().optional(),
      clicks: z.number().int().nonnegative().optional(),
    })
    .optional(),
  error: z.string().nullable().optional(),
  createdAt: Timestamp,
});
export type ThreadMessageDoc = z.infer<typeof ThreadMessageDocSchema>;

export const EmailQueueDocSchema = z.object({
  userId: z.string(),
  orgId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  targetId: z.string(),
  threadId: z.string().nullable().optional(),
  payload: z.object({
    to: z.string().email(),
    subject: z.string(),
    bodyHtml: z.string().nullable().optional(),
    bodyText: z.string().nullable().optional(),
    inReplyTo: z.string().nullable().optional(),
    references: z.array(z.string()).nullable().optional(),
    gmailThreadId: z.string().nullable().optional(),
  }),
  status: z.enum(["scheduled", "locked", "sent", "error", "canceled"]),
  scheduledAt: Timestamp,
  lockedAt: Timestamp.nullable().optional(),
  lockedBy: z.string().nullable().optional(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable().optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type EmailQueueDoc = z.infer<typeof EmailQueueDocSchema>;

export const GmailIntegrationDocSchema = z.object({
  connected: z.boolean(),
  emailAddress: z.string().email(),
  scopes: z.array(z.string()),
  tokenSecretId: z.string(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type GmailIntegrationDoc = z.infer<typeof GmailIntegrationDocSchema>;

export const SuppressionDocSchema = z.object({
  emailHash: z.string(),
  reason: z.enum(["bounce", "unsubscribe", "complaint", "manual", "gdpr"]),
  source: z.object({
    campaignId: z.string().optional(),
    threadId: z.string().optional(),
  }),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type SuppressionDoc = z.infer<typeof SuppressionDocSchema>;

export const WebhookEventDocSchema = z.object({
  source: z.enum(["stripe", "gmail", "system"]),
  type: z.string(),
  status: z.enum(["received", "processed", "error"]),
  summary: z.string(),
  payloadRef: z.string().nullable().optional(),
  receivedAt: Timestamp,
  processedAt: Timestamp.nullable().optional(),
  error: z.string().nullable().optional(),
  ttl: Timestamp.optional(),
});
export type WebhookEventDoc = z.infer<typeof WebhookEventDocSchema>;

export const ConfigDocSchema = z.object({
  gmailLabelName: z.string(),
  maxDailyCapDefault: z.number().int().positive(),
  searchDefaults: z.record(z.unknown()).optional(),
  featureFlags: z.record(z.boolean()).optional(),
  updatedAt: Timestamp,
});
export type ConfigDoc = z.infer<typeof ConfigDocSchema>;

export const UsageDocSchema = UsageSchema;
export type UsageDoc = z.infer<typeof UsageDocSchema>;
