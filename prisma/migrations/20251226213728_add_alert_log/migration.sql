-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertLog_key_date_idx" ON "AlertLog"("key", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AlertLog_key_date_key" ON "AlertLog"("key", "date");
