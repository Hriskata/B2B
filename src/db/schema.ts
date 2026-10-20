import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Customers and admins live in separate tables on purpose (checklist D):
// a bug in customer code must not be able to turn a customer into an admin.

export const userStatus = pgEnum("user_status", ["unverified", "active", "blocked"]);
export const adminRole = pgEnum("admin_role", ["viewer", "editor"]);
export const adminStatus = pgEnum("admin_status", ["active", "blocked"]);
export const subjectType = pgEnum("subject_type", ["user", "admin"]);
// "full" is a normal session. The two mfa_* stages are short-lived sessions
// issued after the admin password check and before the second factor.
export const sessionStage = pgEnum("session_stage", ["full", "mfa_verify", "mfa_setup"]);
export const emailTokenPurpose = pgEnum("email_token_purpose", [
  "verify_email",
  "reset_password",
]);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const companies = pgTable("companies", {
  id: uuid().primaryKey().defaultRandom(),
  eik: text().notNull().unique(),
  name: text().notNull(),
  // Set when an admin blocks the whole company: all its users lose access.
  blockedAt: timestamptz("blocked_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    // Stored lower-cased and trimmed; uniqueness is on this value.
    email: text().notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    status: userStatus().notNull().default("unverified"),
    emailVerifiedAt: timestamptz("email_verified_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("users_company_id_idx").on(t.companyId)],
);

export const admins = pgTable("admins", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole().notNull(),
  status: adminStatus().notNull().default("active"),
  // AES-256-GCM encrypted TOTP secret (see lib/crypto.ts). Set when setup
  // starts; totpEnabledAt is set only after the first code is confirmed.
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabledAt: timestamptz("totp_enabled_at"),
  // Last accepted TOTP time step, to reject replay of a used code.
  totpLastStep: integer("totp_last_step"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const adminRecoveryCodes = pgTable(
  "admin_recovery_codes",
  {
    id: uuid().primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamptz("used_at"),
  },
  (t) => [index("admin_recovery_codes_admin_id_idx").on(t.adminId)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the random cookie value; the raw value is never stored.
    tokenHash: text("token_hash").primaryKey(),
    subjectType: subjectType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    stage: sessionStage().notNull().default("full"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (t) => [index("sessions_subject_idx").on(t.subjectType, t.subjectId)],
);

export const emailTokens = pgTable(
  "email_tokens",
  {
    // sha256 of the random token sent by email.
    tokenHash: text("token_hash").primaryKey(),
    purpose: emailTokenPurpose().notNull(),
    subjectType: subjectType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
  },
  (t) => [index("email_tokens_subject_idx").on(t.subjectType, t.subjectId, t.purpose)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: timestamptz("reset_at").notNull(),
});

export const productSeries = pgEnum("product_series", ["hds", "uds", "quick-fit", "mpo"]);

// Catalog. Prices live in their own table on purpose: public queries only
// ever read `products`, so a price cannot leak into a page, a sitemap or a
// cached response by selecting too many columns.
export const products = pgTable("products", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull(),
  // English text; null = use the generated English text or the Bulgarian one.
  descriptionEn: text("description_en"),
  published: boolean().notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // Technical data (phase 3B). All nullable: products created before the
  // ODFFiber import (and any product without a known value) simply have none.
  // Fibers per rack unit is computed, never stored.
  sku: text().unique(),
  series: productSeries(),
  connector: text(),
  ports: integer(),
  mpoPorts: integer("mpo_ports"),
  fibers: integer(),
  maxFibersVariant: integer("max_fibers_variant"),
  rackUnits: integer("rack_units"),
  polish: text().array(),
  splice: boolean(),
  // null = not known yet (the catalog text does not say).
  frontDoor: boolean("front_door"),
  catalogPage: integer("catalog_page"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const productPrices = pgTable(
  "product_prices",
  {
    productId: uuid("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    // Price for ONE unit, in the smallest currency unit (euro cents).
    amountCents: integer("amount_cents").notNull(),
    currency: text().notNull().default("EUR"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [check("product_prices_amount_positive", sql`${t.amountCents} > 0`)],
);

// Journal of admin actions (prices, 2FA resets, blocking, catalog edits).
// Rows are only ever inserted. The actor email is copied so the entry stays
// readable if the admin account is changed later. `details` must never hold
// passwords, tokens, codes or secrets.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorAdminId: uuid("actor_admin_id").references(() => admins.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text().notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    details: jsonb().$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_at_idx").on(t.createdAt)],
);
