ALTER TABLE "ProjectMember" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "ProjectMember" ADD COLUMN "invitedEmail" TEXT;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_user_or_email_check"
  CHECK (("userId" IS NOT NULL) OR ("invitedEmail" IS NOT NULL));
CREATE UNIQUE INDEX "ProjectMember_projectId_invitedEmail_key"
  ON "ProjectMember"("projectId", "invitedEmail");
