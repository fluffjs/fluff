import type { RouteGuard } from './RouteGuard.js';

export interface RouteEntry
{
    readonly path: string;
    readonly componentLoader: () => Promise<CustomElementConstructor>;
    readonly selector: string;
    readonly guard: readonly (new () => RouteGuard)[];
    readonly redirectTo?: string;
    readonly pathMatch: 'full' | 'prefix';
    readonly children: readonly RouteEntry[];
    readonly isWildcard: boolean;
}
