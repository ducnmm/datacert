-- CreateTable
CREATE TABLE "TrustScoreHistory" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "provenanceScore" INTEGER NOT NULL,
    "integrityScore" INTEGER NOT NULL,
    "auditScore" INTEGER NOT NULL,
    "usageScore" INTEGER NOT NULL,
    "verifiedByNautilus" BOOLEAN NOT NULL DEFAULT false,
    "factors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustScoreHistory_datasetId_createdAt_idx" ON "TrustScoreHistory"("datasetId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrustScoreHistory" ADD CONSTRAINT "TrustScoreHistory_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
