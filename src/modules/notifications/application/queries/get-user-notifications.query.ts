// src/modules/notifications/application/queries/get-user-notifications.query.ts
export class GetUserNotificationsQuery {
  constructor(
    public readonly userId: string,
    public readonly unreadOnly: boolean = false,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
