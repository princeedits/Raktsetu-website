import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const donorsTable = pgTable(
  "raktsetu_donors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    bloodGroup: text("blood_group").notNull(),
    city: text("city").notNull(),
    area: text("area").notNull(),
    phone: text("phone").notNull(),
    available: boolean("available").notNull().default(true),
    shareContact: boolean("share_contact").notNull().default(false),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(false),
    lastDonatedAt: date("last_donated_at", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("raktsetu_donors_group_city_idx").on(table.bloodGroup, table.city),
    index("raktsetu_donors_available_idx").on(table.available),
  ],
);

export const bloodBanksTable = pgTable(
  "raktsetu_blood_banks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    area: text("area").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    hours: text("hours").notNull(),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("raktsetu_banks_city_idx").on(table.city)],
);

export const emergencyRequestsTable = pgTable(
  "raktsetu_emergency_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackingCode: text("tracking_code").notNull().unique(),
    patientName: text("patient_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    bloodGroup: text("blood_group").notNull(),
    city: text("city").notNull(),
    area: text("area").notNull(),
    hospital: text("hospital").notNull(),
    units: integer("units").notNull(),
    urgency: text("urgency").notNull(),
    status: text("status").notNull().default("active"),
    neededBy: timestamp("needed_by", { withTimezone: true }),
    details: text("details").notNull().default(""),
    consentToContact: boolean("consent_to_contact").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("raktsetu_requests_group_city_status_idx").on(
      table.bloodGroup,
      table.city,
      table.status,
    ),
    index("raktsetu_requests_created_idx").on(table.createdAt),
  ],
);

export const donorResponsesTable = pgTable(
  "raktsetu_donor_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => emergencyRequestsTable.id, { onDelete: "cascade" }),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donorsTable.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    shareContact: boolean("share_contact").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("raktsetu_responses_request_donor_unique").on(
      table.requestId,
      table.donorId,
    ),
    index("raktsetu_responses_request_idx").on(table.requestId),
  ],
);

export const contactRequestsTable = pgTable(
  "raktsetu_contact_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackingCode: text("tracking_code").notNull().unique(),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donorsTable.id, { onDelete: "cascade" }),
    requesterName: text("requester_name").notNull(),
    requesterPhone: text("requester_phone").notNull(),
    requesterEmail: text("requester_email"),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    sharePhone: boolean("share_phone").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("raktsetu_contact_requests_donor_idx").on(table.donorId, table.createdAt),
  ],
);

export const reportsTable = pgTable(
  "raktsetu_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("raktsetu_reports_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const donorBlocksTable = pgTable(
  "raktsetu_donor_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerClerkUserId: text("owner_clerk_user_id").notNull(),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donorsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("raktsetu_donor_blocks_owner_donor_unique").on(
      table.ownerClerkUserId,
      table.donorId,
    ),
  ],
);

