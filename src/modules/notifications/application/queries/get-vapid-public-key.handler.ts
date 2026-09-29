// src/modules/notifications/application/queries/get-vapid-public-key.handler.ts

import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetVapidPublicKeyQuery } from './get-vapid-public-key.query';
import { WebPushService } from '../../infrastructure/push/web-push.service';

@Injectable()
@QueryHandler(GetVapidPublicKeyQuery)
export class GetVapidPublicKeyHandler implements IQueryHandler<GetVapidPublicKeyQuery> {
  constructor(private readonly webPush: WebPushService) {}

  async execute(): Promise<{ publicKey: string }> {
    return {
      publicKey: this.webPush.getPublicKey(),
    };
  }
}
