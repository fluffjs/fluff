import type { RouteContext } from './RouteContext.js';

export interface RouteGuard
{
    canActivate: (context: RouteContext) => boolean | Promise<boolean>;
}
