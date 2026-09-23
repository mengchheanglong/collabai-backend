CREATE TABLE "Document" (
 "id" UUID NOT NULL, "projectId" UUID NOT NULL, "createdById" UUID NOT NULL,
 "title" TEXT NOT NULL, "content" TEXT NOT NULL DEFAULT '',
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
 CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Document_projectId_deletedAt_updatedAt_idx" ON "Document"("projectId", "deletedAt", "updatedAt");
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
