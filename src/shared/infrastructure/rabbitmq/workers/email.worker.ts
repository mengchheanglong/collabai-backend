// src/shared/infrastructure/rabbitmq/workers/email.worker.ts
//
// Consumes `collabai.email` (email.*) and delivers the transactional email via EmailService.
// Publishers (auth listener, invite/resend-invitation handlers) only enqueue, so REST
// requests no longer wait on the Mailjet/Resend/SMTP round-trip.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailService } from '../../../services/email.service';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUE, ROUTING_KEY } from '../rabbitmq.constants';

/** Surface delivery failures so the bus retries and finally dead-letters the job. */
const STRICT = { throwOnError: true };

export interface VerifyEmailJob {
  to: string;
  code: string;
}

export interface PasswordResetEmailJob {
  to: string;
  code: string;
}

export interface PasswordResetSuccessEmailJob {
  to: string;
}

export interface ProjectInvitationEmailJob {
  to: string;
  projectName: string;
  inviterName: string;
  inviteUrl: string;
}

@Injectable()
export class EmailWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.rabbitmq.consume(QUEUE.EMAIL, (payload, routingKey) =>
      this.handle(routingKey, payload),
    );
  }

  async handle(routingKey: string, payload: any): Promise<void> {
    switch (routingKey) {
      case ROUTING_KEY.EMAIL_VERIFY: {
        const job = payload as VerifyEmailJob;
        await this.emailService.sendVerificationCode(job.to, job.code, STRICT);
        return;
      }
      case ROUTING_KEY.EMAIL_PASSWORD_RESET: {
        const job = payload as PasswordResetEmailJob;
        await this.emailService.sendPasswordResetCode(job.to, job.code, STRICT);
        return;
      }
      case ROUTING_KEY.EMAIL_PASSWORD_RESET_SUCCESS: {
        const job = payload as PasswordResetSuccessEmailJob;
        await this.emailService.sendPasswordResetSuccess(job.to, STRICT);
        return;
      }
      case ROUTING_KEY.EMAIL_PROJECT_INVITATION: {
        const job = payload as ProjectInvitationEmailJob;
        await this.emailService.sendProjectInvitation(
          job.to,
          job.projectName,
          job.inviterName,
          job.inviteUrl,
          STRICT,
        );
        return;
      }
      default:
        this.logger.warn(`Unknown email job "${routingKey}" — skipped`);
    }
  }
}
