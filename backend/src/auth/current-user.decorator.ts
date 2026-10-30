import {createParamDecorator, ExecutionContext} from '@nestjs/common';
import type {AuthUser} from '../common/auth-user.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
