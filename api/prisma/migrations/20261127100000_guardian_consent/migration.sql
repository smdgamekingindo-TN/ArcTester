CREATE TABLE "GuardianConsent" (
    "id" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "guardianEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuardianConsent_tokenHash_key" ON "GuardianConsent"("tokenHash");
CREATE INDEX "GuardianConsent_studentId_consentedAt_idx" ON "GuardianConsent"("studentId", "consentedAt");
CREATE INDEX "GuardianConsent_guardianEmail_expiresAt_idx" ON "GuardianConsent"("guardianEmail", "expiresAt");
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
