CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "privacyNoticeVersion" TEXT NOT NULL,
  "consentNoticeVersion" TEXT NOT NULL,
  "ageGateVersion" TEXT NOT NULL,
  "ageAttested" BOOLEAN NOT NULL DEFAULT FALSE,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'web',
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId","acceptedAt");
CREATE INDEX "LegalAcceptance_acceptedAt_idx" ON "LegalAcceptance"("acceptedAt");
