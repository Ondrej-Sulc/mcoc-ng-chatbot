-- CreateTable
CREATE TABLE "public"."UploadToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadToken_token_key" ON "public"."UploadToken"("token");

-- CreateIndex
CREATE INDEX "UploadToken_playerId_idx" ON "public"."UploadToken"("playerId");

-- AddForeignKey
ALTER TABLE "public"."UploadToken" ADD CONSTRAINT "UploadToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
