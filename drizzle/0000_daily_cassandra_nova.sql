CREATE TABLE `assessment_results` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`score` integer NOT NULL,
	`total_points` integer NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`node_mastery_updates` text DEFAULT '[]' NOT NULL,
	`submitted_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_task_id` text NOT NULL,
	`knowledge_node_ids` text DEFAULT '[]' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`total_points` integer NOT NULL,
	`pass_threshold` integer DEFAULT 60 NOT NULL,
	`created_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`referenced_node_ids` text DEFAULT '[]' NOT NULL,
	`proposed_graph_patch` text,
	`created_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`context_type` text DEFAULT 'general' NOT NULL,
	`context_target_id` text,
	`context_label` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`type` text NOT NULL,
	`weight` integer DEFAULT 50 NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`subject` text NOT NULL,
	`type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`mastery` integer DEFAULT 0 NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`source_ids` text DEFAULT '[]' NOT NULL,
	`last_studied_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`raw_output` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lectures` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_task_id` text NOT NULL,
	`title` text NOT NULL,
	`audience_level` text NOT NULL,
	`prerequisites` text DEFAULT '[]' NOT NULL,
	`sections` text DEFAULT '[]' NOT NULL,
	`examples` text DEFAULT '[]' NOT NULL,
	`exercises` text DEFAULT '[]' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`reference_sources` text DEFAULT '[]' NOT NULL,
	`generated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`order` integer NOT NULL,
	`estimated_days` integer NOT NULL,
	`learning_objectives` text DEFAULT '[]' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plan_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`objectives` text DEFAULT '[]' NOT NULL,
	`knowledge_node_refs` text DEFAULT '[]' NOT NULL,
	`lecture_id` text,
	`assessment_id` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`completed_at` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `plan_stages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`goal` text NOT NULL,
	`user_level` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reference_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`file_path` text,
	`title` text NOT NULL,
	`excerpt` text,
	`credibility` integer DEFAULT 50 NOT NULL,
	`imported_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
