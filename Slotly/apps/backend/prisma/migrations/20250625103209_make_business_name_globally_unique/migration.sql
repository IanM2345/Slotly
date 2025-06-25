/*
  Warnings:

  - You are about to drop the column `time` on the `Booking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Business` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `endTime` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "Business_name_ownerId_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "time",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "BusinessVerification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "regNumber" TEXT,
    "idPhotoUrl" TEXT NOT NULL,
    "selfieWithIdUrl" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerification_businessId_key" ON "BusinessVerification"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Business_name_key" ON "Business"("name");

-- AddForeignKey
ALTER TABLE "BusinessVerification" ADD CONSTRAINT "BusinessVerification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
