import type { RouteGuard } from './RouteGuard.js';

export interface RouteConfig
{
    readonly path: string;
    readonly guard?: readonly (new () => RouteGuard)[];
    readonly redirectTo?: string;
    readonly pathMatch?: 'full' | 'prefix';
    readonly children?: readonly (new (...args: unknown[]) => HTMLElement)[];
}
