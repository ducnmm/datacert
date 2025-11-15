-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "walrusBlobId" TEXT,
    "certificateId" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "fileType" TEXT NOT NULL DEFAULT 'text/csv',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessType" TEXT NOT NULL DEFAULT 'stake_gated',
    "minStakeAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "claimant" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRecord" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "stakeAmount" INTEGER NOT NULL DEFAULT 0,
    "txHash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_datasetId_key" ON "Dataset"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_certificateId_key" ON "Dataset"("certificateId");

-- CreateIndex
CREATE INDEX "Dataset_datasetId_idx" ON "Dataset"("datasetId");

-- CreateIndex
CREATE INDEX "Dataset_owner_idx" ON "Dataset"("owner");

-- CreateIndex
CREATE INDEX "Dataset_status_idx" ON "Dataset"("status");

-- CreateIndex
CREATE INDEX "Claim_datasetId_idx" ON "Claim"("datasetId");

-- CreateIndex
CREATE INDEX "Claim_claimant_idx" ON "Claim"("claimant");

-- CreateIndex
CREATE INDEX "Claim_severity_idx" ON "Claim"("severity");

-- CreateIndex
CREATE INDEX "AccessRecord_datasetId_idx" ON "AccessRecord"("datasetId");

-- CreateIndex
CREATE INDEX "AccessRecord_requester_idx" ON "AccessRecord"("requester");

-- CreateIndex
CREATE INDEX "AccessRecord_timestamp_idx" ON "AccessRecord"("timestamp");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRecord" ADD CONSTRAINT "AccessRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
