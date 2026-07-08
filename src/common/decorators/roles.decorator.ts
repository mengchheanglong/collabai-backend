// src/common/decorators/roles.decorator.ts
//
// Generic RBAC metadata decorator. Attach required role names to a route/controller;
// RolesGuard reads them via Reflector. Role strings are intentionally left open
// (no enum) so any module can define its own roles.

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
