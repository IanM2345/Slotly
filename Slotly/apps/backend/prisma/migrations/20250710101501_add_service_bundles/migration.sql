-- CreateTable
CREATE TABLE "ServiceBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceInBundle" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ServiceInBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceBundle_businessId_idx" ON "ServiceBundle"("businessId");

-- CreateIndex
CREATE INDEX "ServiceInBundle_bundleId_idx" ON "ServiceInBundle"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceInBundle_bundleId_serviceId_key" ON "ServiceInBundle"("bundleId", "serviceId");

-- AddForeignKey
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInBundle" ADD CONSTRAINT "ServiceInBundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ServiceBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInBundle" ADD CONSTRAINT "ServiceInBundle_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
