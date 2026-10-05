// src/modules/auth/infrastructure/event-handlers/auth-events.listener.ts
//
// Subscribes to auth domain events and enqueues the corresponding transactional emails on
// the `collabai.email` queue (EmailWorker delivers them, with retries + DLQ). Without a
// broker the job still runs in-process, so a delivery problem never breaks the auth flow.
// Requires EventEmitterModule (app.module) and this listener registered in AuthModule.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  EVENT_BUS,
  type IEventBus,
} from '../../../../shared/event-bus/event-bus.interface';
import { ROUTING_KEY } from '../../../../shared/infrastructure/rabbitmq/rabbitmq.constants';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { PasswordResetSuccessEvent } from '../../domain/events/password-reset-success.event';

@Injectable()
export class AuthEventsListener {
  private readonly logger = new Logger(AuthEventsListener.name);

  constructor(@Inject(EVENT_BUS) private readonly bus: IEventBus) {}

  @OnEvent(UserRegisteredEvent.eventName)
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(`Queueing verification email to ${event.email}`);
    await this.bus.publish(ROUTING_KEY.EMAIL_VERIFY, {
      to: event.email,
      code: event.verificationCode,
    });
  }

  @OnEvent(PasswordResetRequestedEvent.eventName)
  async handlePasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): Promise<void> {
    this.logger.log(`Queueing password-reset email to ${event.email}`);
    await this.bus.publish(ROUTING_KEY.EMAIL_PASSWORD_RESET, {
      to: event.email,
      code: event.resetCode,
    });
  }

  @OnEvent(PasswordResetSuccessEvent.eventName)
  async handlePasswordResetSuccess(
    event: PasswordResetSuccessEvent,
  ): Promise<void> {
    this.logger.log(`Queueing password-reset confirmation to ${event.email}`);
    await this.bus.publish(ROUTING_KEY.EMAIL_PASSWORD_RESET_SUCCESS, {
      to: event.email,
    });
  }
}
