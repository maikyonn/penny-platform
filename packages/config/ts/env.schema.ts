import { z } from "zod";

export const EnvSchema = z.object({
  // Profile & logging
  PROFILE: z.enum(["dev", "test", "ci", "staging", "prod"]).default("dev"),
  APP_ENV: z.string().default("local"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  STORAGE_EMULATOR_HOST: z.string().optional(),
  PUBSUB_EMULATOR_HOST: z.string().optional(),

  // Web client (only PUBLIC_ vars go to the browser)
  PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
  PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1).optional(),
  PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),

  // Internal services
  INTERNAL_API_ORIGIN: z.string().url().optional(),
  SEARCH_API_URL: z.string().url().default("http://localhost:7001"),
  BRIGHTDATA_API_URL: z.string().url().default("http://localhost:7100"),
  VIEWER_PORT: z.coerce.number().default(7002),
  VIEWER_ROOT_PATH: z.string().default("/db-viewer"),

  // Database settings
  DB_PATH: z.string().optional(),
  TEXT_DB_PATH: z.string().optional(),
  TABLE_NAME: z.string().default("influencer_facets"),

  // Search API settings
  SEARCH_API_PORT: z.coerce.number().default(7001),
  API_V1_PREFIX: z.string().default("/search"),

  // BrightData settings
  BRIGHTDATA_API_KEY: z.string().optional(),
  BRIGHTDATA_API_TOKEN: z.string().optional(),
  BRIGHTDATA_INSTAGRAM_DATASET_ID: z.string().optional(),
  BRIGHTDATA_TIKTOK_DATASET_ID: z.string().optional(),
  BRIGHTDATA_BASE_URL: z.string().url().default("https://api.brightdata.com/datasets/v3"),
  BRIGHTDATA_MAX_URLS: z.coerce.number().default(50),
  BRIGHTDATA_JOB_TIMEOUT: z.coerce.number().default(600),
  BRIGHTDATA_JOB_POLL_INTERVAL: z.coerce.number().default(5),
  BRIGHTDATA_FETCH_TIMEOUT: z.coerce.number().default(300),
  BRIGHTDATA_MAX_CONCURRENCY: z.coerce.number().default(5),
  BRIGHTDATA_JOBS_IMMEDIATE: z.coerce.boolean().default(false),
  BRIGHTDATA_SERVICE_URL: z.string().url().default("http://localhost:7100/brightdata/images"),

  // OpenAI / LLM settings
  OPENAI_API_KEY: z.string().optional(),

  // DeepInfra embeddings
  DEEPINFRA_API_KEY: z.string().optional(),
  DEEPINFRA_ENDPOINT: z.string().url().default("https://api.deepinfra.com/v1/openai"),
  EMBED_MODEL: z.string().default("google/embeddinggemma-300m"),

  // Reranker settings
  RERANKER_ENABLED: z.coerce.boolean().default(true),
  RERANKER_ENDPOINT: z.string().url().default("https://api.deepinfra.com/v1/inference/Qwen/Qwen3-Reranker-8B"),
  RERANKER_SERVICE_URL: z.string().url().default("http://localhost:7100/brightdata/rerank"),
  RERANKER_TOP_K: z.coerce.number().default(200),

  // Redis / RQ settings
  REDIS_URL: z.string().default("redis://127.0.0.1:6379/0"),
  RQ_JOB_TIMEOUT: z.coerce.number().default(900),
  RQ_RESULT_TTL: z.coerce.number().default(3600),
  RQ_WORKER_QUEUES: z.string().default("default,search,pipeline"),
  RQ_PUBSUB_EVENTS: z.coerce.boolean().default(true),
  RQ_EVENTS_CHANNEL_PREFIX: z.string().default("jobs"),

  // Integrations
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),

  // Feature flags
  FEATURE_AI: z.coerce.boolean().default(true),
  FEATURE_BRIGHTDATA: z.coerce.boolean().default(false),

  // CORS settings
  ALLOWED_ORIGINS: z.string().default("*"),

  // Common
  PENNY_DEFAULT_REGION: z.string().default("us-central1"),
});

export type Env = z.infer<typeof EnvSchema>;

