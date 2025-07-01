-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'RESCHEDULED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationDeadlineMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "lateCancellationFee" INTEGER NOT NULL DEFAULT 5000;
