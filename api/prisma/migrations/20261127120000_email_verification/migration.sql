-- Add verified-email state while preserving access for existing accounts.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
