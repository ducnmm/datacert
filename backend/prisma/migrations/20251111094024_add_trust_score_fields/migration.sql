-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "trustFactors" JSONB,
ADD COLUMN     "trustScore" INTEGER;

-- CreateIndex
CREATE INDEX "Dataset_trustScore_idx" ON "Dataset"("trustScore");
