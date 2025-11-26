-- CreateTable
CREATE TABLE "BarberAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "barberId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BarberAvailability_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BarberAvailability_barberId_dayOfWeek_startTime_endTime_key" ON "BarberAvailability"("barberId", "dayOfWeek", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "BarberAvailability_barberId_dayOfWeek_idx" ON "BarberAvailability"("barberId", "dayOfWeek");



