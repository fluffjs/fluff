import type { MatchResult } from './interfaces/MatchResult.js';
import type { RouteEntry } from './interfaces/RouteEntry.js';
import type { RouteGuard } from './interfaces/RouteGuard.js';
import { RouteMatcher } from './RouteMatcher.js';

interface ResolvedRoute
{
    readonly entry: RouteEntry;
    readonly match: MatchResult;
}

export class RouteRegistry
{
    private static instance: RouteRegistry | null = null;
    private readonly routes: RouteEntry[] = [];
    private basePath = '';

    public static getInstance(): RouteRegistry
    {
        RouteRegistry.instance ??= new RouteRegistry();
        return RouteRegistry.instance;
    }

    public static resetInstance(): void
    {
        RouteRegistry.instance = null;
    }

    public setBasePath(basePath: string): void
    {
        this.basePath = RouteMatcher.normalizePath(basePath);
        if (this.basePath === '/')
        {
            this.basePath = '';
        }
    }

    public getBasePath(): string
    {
        return this.basePath;
    }

    public register(entry: RouteEntry): void
    {
        this.routes.push(entry);
    }

    public getRoutes(): readonly RouteEntry[]
    {
        return this.routes;
    }

    public resolve(fullPath: string): ResolvedRoute | null
    {
        const path = this.stripBasePath(fullPath);
        return this.matchInEntries(this.routes, path);
    }

    public resolveChildren(parentPath: string, children: readonly RouteEntry[]): ResolvedRoute | null
    {
        const fullPath = this.stripBasePath(parentPath);
        return this.matchInEntries(children, fullPath);
    }

    public async runGuards(entry: RouteEntry, path: string, params: ReadonlyMap<string, string>, queryParams: ReadonlyMap<string, string>, fragment: string | null): Promise<boolean>
    {
        for (const GuardClass of entry.guard)
        {
            const guard: RouteGuard = new GuardClass();
            const allowed = await guard.canActivate({ path, params, queryParams, fragment });
            if (!allowed)
            {
                return false;
            }
        }
        return true;
    }

    private stripBasePath(path: string): string
    {
        if (this.basePath && path.startsWith(this.basePath))
        {
            return path.slice(this.basePath.length) || '/';
        }
        return path;
    }

    private matchInEntries(entries: readonly RouteEntry[], path: string): ResolvedRoute | null
    {
        let wildcardMatch: ResolvedRoute | null = null;

        for (const entry of entries)
        {
            if (entry.isWildcard)
            {
                wildcardMatch = {
                    entry,
                    match: {
                        params: new Map<string, string>(),
                        path,
                        isWildcard: true,
                        remainingPath: ''
                    }
                };
                continue;
            }

            if (entry.redirectTo !== undefined)
            {
                const match = RouteMatcher.match(entry.path, path, entry.pathMatch);
                if (match)
                {
                    return { entry, match };
                }
                continue;
            }

            const hasChildren = entry.children.length > 0;
            const effectivePathMatch = hasChildren ? 'prefix' : entry.pathMatch;
            const match = RouteMatcher.match(entry.path, path, effectivePathMatch);
            if (match)
            {
                return { entry, match };
            }
        }

        return wildcardMatch;
    }
}
