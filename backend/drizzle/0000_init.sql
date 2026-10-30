CREATE TABLE `balances` (
	`user_id` text PRIMARY KEY NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "balances_amount_non_negative" CHECK("balances"."amount_cents" >= 0),
	CONSTRAINT "balances_currency_usd" CHECK("balances"."currency" = 'USD')
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`operation` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text NOT NULL,
	`transaction_id` integer,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_after_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`idempotency_key` text,
	`webhook_event_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_amount_range" CHECK("transactions"."amount_cents" > 0 AND "transactions"."amount_cents" <= 1000000),
	CONSTRAINT "transactions_balance_after_non_negative" CHECK("transactions"."balance_after_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_webhook_event_id_unique` ON `transactions` (`webhook_event_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_id_idx` ON `transactions` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`outcome` text NOT NULL,
	`raw_payload` text NOT NULL,
	`deliveries` integer DEFAULT 1 NOT NULL,
	`transaction_id` integer,
	`received_at` text NOT NULL,
	`last_received_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
