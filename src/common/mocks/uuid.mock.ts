import { randomUUID } from 'crypto';

export const v4 = (): string => randomUUID();
export const v1 = (): string => randomUUID();
export const validate = (uuid: string): boolean =>
  typeof uuid === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

export default { v4, v1, validate };
