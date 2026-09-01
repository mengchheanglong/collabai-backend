// src/modules/notifications/application/commands/subscribe-push.handler.ts

import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SubscribePushCommand } from './subscribe-push.command';
import { PushSubscriptionEntity } from '../../domain/entities/push-subscription.entity';
import type { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../../domain/repositories/push-subscription.repository.interface';
import { InvalidPushSubscriptionError } from '../errors/notification.errors';

@Injectable()
@CommandHandler(SubscribePushCommand)
export class SubscribePushHandler
  implements ICommandHandler<SubscribePushCommand>
{
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: IPushSubscriptionRepository,
  ) {}

  async execute(command: SubscribePushCommand): Promise<void> {
    if (
      !command ||
      !command.userId ||
      !command.endpoint ||
      !command.p256dh ||
      !command.auth
    ) {
      throw new InvalidPushSubscriptionError();
    }

    const entity = PushSubscriptionEntity.create({
      userId: command.userId,
      endpoint: command.endpoint,
      p256dh: command.p256dh,
      auth: command.auth,
      userAgent: command.userAgent,
    });
    await this.repo.save(entity);
  }
}
