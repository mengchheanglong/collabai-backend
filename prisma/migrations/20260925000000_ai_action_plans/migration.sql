CREATE TABLE "AiActionPlan" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    "request" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "AiActionPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiActionPlan_projectId_createdAt_idx" ON "AiActionPlan"("projectId", "createdAt");
CREATE INDEX "AiActionPlan_requestedBy_status_idx" ON "AiActionPlan"("requestedBy", "status");

ALTER TABLE "AiActionPlan" ADD CONSTRAINT "AiActionPlan_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiActionPlan" ADD CONSTRAINT "AiActionPlan_requestedBy_fkey"
    FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
