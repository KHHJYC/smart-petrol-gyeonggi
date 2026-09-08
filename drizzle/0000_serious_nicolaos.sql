CREATE TABLE `patrols` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`city` text NOT NULL,
	`memo` text NOT NULL,
	`checks` text NOT NULL,
	`started` text NOT NULL,
	`ended` text NOT NULL,
	`seconds` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `patrols_owner_ended` ON `patrols` (`owner`,`ended`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`city` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`observed_at` text NOT NULL,
	`status` text DEFAULT '접수' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`radius` integer NOT NULL,
	`cctv` integer,
	`lights` integer,
	`source_at` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_owner_created` ON `reports` (`owner`,`created`);