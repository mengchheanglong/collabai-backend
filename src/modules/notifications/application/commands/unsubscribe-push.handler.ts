// src/modules/notifications/application/commands/unsubscribe-push.handler.ts

import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnsubscribePushCommand } from './unsubscribe-push.command';
import type { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../../domain/repositories/push-subscription.repository.interface';

@Injectable()
@CommandHandler(UnsubscribePushCommand)
export class UnsubscribePushHandler implements ICommandHandler<UnsubscribePushCommand> {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: IPushSubscriptionRepository,
  ) {}

  async execute(command: UnsubscribePushCommand): Promise<void> {
    await this.repo.deleteByEndpointAndUserId(command.endpoint, command.userId);
  }
}
