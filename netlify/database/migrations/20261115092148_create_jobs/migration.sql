CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY,
	"owner" uuid NOT NULL,
	"url" text NOT NULL,
	"instruction" text NOT NULL,
	"runtime" text NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"plan" text,
	"result" text,
	"dispatch_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_job" ON "jobs" ((1)) WHERE "status" IN ('queued', 'running');
