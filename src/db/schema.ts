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
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Customers and admins live in separate tables on purpose (checklist D):
// a bug in customer code must not be able to turn a customer into an admin.

// pending_review: email confirmed, waiting for an admin (foreign companies;
// in phase 2 also registrations whose company check failed). rejected: an
// admin turned the registration down. New values are only used by the code,
// never in migration SQL (docs/ENVIRONMENTS.md, "Migrations", rule 4).
export const userStatus = pgEnum("user_status", [
  "unverified",
  "active",
  "blocked",
  "pending_review",
  "rejected",
]);
export const adminRole = pgEnum("admin_role", ["viewer", "editor"]);
export const adminStatus = pgEnum("admin_status", ["active", "blocked"]);
// What the admin is for the business (decided 13.11.2026): "support" keeps the
// site running, "owner" owns it. Same rights and same view (those come from
// the role); only owners get the email about a new inquiry.
export const adminKind = pgEnum("admin_kind", ["support", "owner"]);
export const subjectType = pgEnum("subject_type", ["user", "admin"]);
// "full" is a normal session. The two mfa_* stages are short-lived sessions
// issued after the admin password check and before the second factor.
export const sessionStage = pgEnum("session_stage", ["full", "mfa_verify", "mfa_setup"]);
// admin_invite: the link a new admin gets to set their own password
// (decided 11.11.2026, instead of a temporary password).
export const emailTokenPurpose = pgEnum("email_token_purpose", [
  "verify_email",
  "reset_password",
  "admin_invite",
]);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const companies = pgTable(
  "companies",
  {
    id: uuid().primaryKey().defaultRandom(),
    // ISO 3166-1 alpha-2 code of the country where the company is registered.
    country: text().notNull().default("BG"),
    // EIK for Bulgaria, VAT number for the EU, EIN for the US, the register
    // number elsewhere; stored in the form returned by parseCompanyNumber.
    companyNumber: text("company_number").notNull(),
    name: text().notNull(),
    // Last answer of the company register (Bulgaria only; null = not checked):
    // active, inactive, unknown (a status code not mapped yet) or unavailable.
    registryState: text("registry_state"),
    // The raw status code and name as the register gave them.
    registryStatus: text("registry_status"),
    registryName: text("registry_name"),
    registryCheckedAt: timestamptz("registry_checked_at"),
    // Set when an admin blocks the whole company: all its users lose access.
    blockedAt: timestamptz("blocked_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("companies_country_number_unique").on(t.country, t.companyNumber)],
);

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    // Stored lower-cased and trimmed; uniqueness is on this value.
    email: text().notNull().unique(),
    // Name of the person; null for accounts created before it was asked.
    fullName: text("full_name"),
    passwordHash: text("password_hash").notNull(),
    status: userStatus().notNull().default("unverified"),
    emailVerifiedAt: timestamptz("email_verified_at"),
    // An admin must approve this profile before it becomes active (foreign
    // company, or the register check did not confirm an active company).
    // Safe default: a row written without it (old code, a future import)
    // waits for an admin instead of being approved.
    needsReview: boolean("needs_review").notNull().default(true),
    // Set by the manual review; unblocking returns to the reviewed state.
    approvedAt: timestamptz("approved_at"),
    rejectedAt: timestamptz("rejected_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("users_company_id_idx").on(t.companyId)],
);

export const admins = pgTable("admins", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole().notNull(),
  kind: adminKind().notNull().default("support"),
  status: adminStatus().notNull().default("active"),
  // Set for an admin added from the portal with the default password: every
  // admin page redirects to the password change until it is done.
  passwordMustChange: boolean("password_must_change").notNull().default(false),
  // An account for automated checks during development (admin:create --test,
  // local only). Every journal entry it makes goes to the "development" part
  // of the journal, apart from the changes people make by hand.
  isTest: boolean("is_test").notNull().default(false),
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

// Answers of the company register by EIK, so a repeated check does not use
// the daily request limit. Only definite answers (found / not found).
export const companyCheckCache = pgTable("company_check_cache", {
  eik: text().primaryKey(),
  provider: text().notNull(),
  found: boolean().notNull(),
  status: text(),
  name: text(),
  checkedAt: timestamptz("checked_at").notNull().defaultNow(),
});

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
    // "portal": a person through the admin portal; "dev": a test account
    // (admins.is_test) during development. Fixed when the entry is written,
    // only by writeAudit (no CHECK: rule 9, no constraint on an existing table).
    source: text().$type<"portal" | "dev">().notNull().default("portal"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    index("audit_log_source_created_at_idx").on(t.source, t.createdAt),
  ],
);

// An inquiry from a logged-in customer (phase 4). Rows are kept: the
// statistics count them. Contact name, phone and message are typed by the
// customer and shown to admins as plain text only.
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    contactName: text("contact_name").notNull(),
    phone: text().notNull(),
    message: text(),
    // Random value made by the form once: a second submit of the same form
    // (double click, retry) finds it and creates nothing new.
    clientKey: uuid("client_key").notNull(),
    // The company was inactive in the register when the inquiry came in (or
    // at its last real answer). Only admins see it; they decide whether to
    // take the inquiry (decided 11.11.2026).
    companyInactive: boolean("company_inactive").notNull().default(false),
    registryStatus: text("registry_status"),
    // Decision on an inquiry of an inactive company: "accepted" | "declined".
    decision: text().$type<"accepted" | "declined">(),
    decidedByAdminId: uuid("decided_by_admin_id").references(() => admins.id, { onDelete: "set null" }),
    decidedAt: timestamptz("decided_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("inquiries_user_client_key_unique").on(t.userId, t.clientKey),
    index("inquiries_created_at_idx").on(t.createdAt),
    check("inquiries_decision_known", sql`${t.decision} is null or ${t.decision} in ('accepted', 'declined')`),
  ],
);

// One product of an inquiry. The product name is copied, so an old inquiry
// stays readable after the product is renamed.
export const inquiryItems = pgTable(
  "inquiry_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    productName: text("product_name").notNull(),
    quantity: integer().notNull(),
    // The settings the customer chose (src/lib/product-options.ts), checked
    // against the catalog on the server. null = the model has no such choice.
    polish: text(),
    fibers: integer(),
  },
  (t) => [
    // The same model may be asked for in several settings, each on its own line.
    unique("inquiry_items_line_unique")
      .on(t.inquiryId, t.productId, t.polish, t.fibers)
      .nullsNotDistinct(),
    index("inquiry_items_product_id_idx").on(t.productId),
    check("inquiry_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);
