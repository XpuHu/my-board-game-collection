CREATE TABLE "command_receipts" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "kind" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "result" TEXT NOT NULL,
 "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
