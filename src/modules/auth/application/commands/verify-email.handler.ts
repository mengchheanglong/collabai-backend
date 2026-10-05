// src/modules/auth/application/commands/verify-email.handler.ts
// Flow 2 — Email Verification.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VerifyEmailCommand } from './verify-email.command';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { AuthDomainService } from '../../domain/services/auth.domain.service';
import { EmailVerifiedEvent } from '../../domain/events/email-verified.event';
import {
  CodeExpiredError,
  EmailAlreadyVerifiedError,
  InvalidCodeError,
} from '../errors/auth.errors';

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly authDomain: AuthDomainService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<{ success: true }> {
    const user = await this.userRepo.findByEmail(
      command.email.toLowerCase().trim(),
    );
    if (!user) throw new InvalidCodeError();
    if (user.isVerified) throw new EmailAlreadyVerifiedError();

    const code = command.code?.trim();
    if (!code || user.verificationCode !== code) {
      throw new InvalidCodeError();
    }
    if (this.authDomain.isCodeExpired(user.verificationCodeExpiry)) {
      throw new CodeExpiredError();
    }

    user.markVerified();
    await this.userRepo.save(user);

    // Ownership of the address is now proven — e.g. pending project invitations to it
    // are turned into memberships (InvitationEventsListener).
    this.eventEmitter.emit(
      EmailVerifiedEvent.eventName,
      new EmailVerifiedEvent(user.id, user.email),
    );
    return { success: true };
  }
}
