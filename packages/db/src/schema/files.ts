import { relations } from "drizzle-orm";
import {
	pgTable,
	text,
	timestamp,
	integer,
	index,
	pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const shareTypeEnum = pgEnum("share_type", ["user", "link"]);
export const roleEnum = pgEnum("role", ["owner", "viewer", "editor"]);
export const activityTypeEnum = pgEnum("activity_type", [
	"upload",
	"download",
	"share",
	"unshare",
	"delete",
]);

export const file = pgTable(
	"file",
	{
		id: text("id").primaryKey(),
		filename: text("filename").notNull(),
		cloudinaryId: text("cloudinary_id").notNull(),
		fileUrl: text("file_url").notNull(),
		size: integer("size").notNull(),
		type: text("type").notNull(),
		resourceType: text("resource_type"),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("file_ownerId_idx").on(table.ownerId),
		index("file_createdAt_idx").on(table.createdAt),
	],
);

export const share = pgTable(
	"share",
	{
		id: text("id").primaryKey(),
		fileId: text("file_id")
			.notNull()
			.references(() => file.id, { onDelete: "cascade" }),
		shareType: shareTypeEnum("share_type").notNull(),
		sharedWithUserId: text("shared_with_user_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		token: text("token").unique(),
		role: roleEnum("role").notNull().default("viewer"),
		expiresAt: timestamp("expires_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("share_fileId_idx").on(table.fileId),
		index("share_sharedWithUserId_idx").on(table.sharedWithUserId),
		index("share_token_idx").on(table.token),
	],
);

export const activityLog = pgTable(
	"activity_log",
	{
		id: text("id").primaryKey(),
		fileId: text("file_id")
			.notNull()
			.references(() => file.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		activityType: activityTypeEnum("activity_type").notNull(),
		metadata: text("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("activity_log_fileId_idx").on(table.fileId),
		index("activity_log_userId_idx").on(table.userId),
		index("activity_log_createdAt_idx").on(table.createdAt),
	],
);

export const fileRelations = relations(file, ({ one, many }) => ({
	owner: one(user, {
		fields: [file.ownerId],
		references: [user.id],
	}),
	shares: many(share),
	activityLogs: many(activityLog),
}));

export const shareRelations = relations(share, ({ one }) => ({
	file: one(file, {
		fields: [share.fileId],
		references: [file.id],
	}),
	sharedWithUser: one(user, {
		fields: [share.sharedWithUserId],
		references: [user.id],
	}),
	createdByUser: one(user, {
		fields: [share.createdBy],
		references: [user.id],
	}),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
	file: one(file, {
		fields: [activityLog.fileId],
		references: [file.id],
	}),
	user: one(user, {
		fields: [activityLog.userId],
		references: [user.id],
	}),
}));
