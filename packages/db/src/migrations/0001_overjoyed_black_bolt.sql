ALTER TYPE "public"."role" ADD VALUE 'editor';--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "resource_type" text;