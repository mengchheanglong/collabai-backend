// src/shared/event-bus/event-bus.interface.ts

export const EVENT_BUS = 'EVENT_BUS';

export interface IEventBus {
  publish<T = any>(routingKey: string, payload: T): Promise<void>;
}
