-- DropForeignKey
ALTER TABLE "SuspensionLog" DROP CONSTRAINT "SuspensionLog_userId_fkey";

-- AlterTable
ALTER TABLE "SuspensionLog" ADD COLUMN     "businessId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SuspensionLog" ADD CONSTRAINT "SuspensionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionLog" ADD CONSTRAINT "SuspensionLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
