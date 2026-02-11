import type { RouteContext, RouteGuard } from '@fluffjs/router/runtime';

export class DenyGuard implements RouteGuard
{
    public canActivate(_context: RouteContext): boolean
    {
        return false;
    }
}
