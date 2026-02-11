import type { Subscription } from '@fluffjs/fluff';
import { Publisher } from '@fluffjs/fluff';
import type { NavigateOptions } from './interfaces/NavigateOptions.js';
import type { RouteChangeEvent } from './interfaces/RouteChangeEvent.js';
import { RouteMatcher } from './RouteMatcher.js';
import { RouteRegistry } from './RouteRegistry.js';

export class FluffRouter
{
    private static readonly globalRouteChange = new Publisher<RouteChangeEvent>();
    private static readonly globalParamsChange = new Publisher<ReadonlyMap<string, string>>();
    private static readonly globalQueryParamsChange = new Publisher<ReadonlyMap<string, string>>();
    private static readonly globalFragmentChange = new Publisher<string | null>();
    private static popstateListenerAttached = false;

    private readonly localParamsChange = new Publisher<ReadonlyMap<string, string>>();
    private currentParams = new Map<string, string>();
    private currentQueryParams = new Map<string, string>();
    private currentFragment: string | null = null;
    private currentPath = '';


    public constructor()
    {
        FluffRouter.ensurePopstateListener();
        this.syncFromUrl();
    }

    public get params(): ReadonlyMap<string, string>
    {
        return this.currentParams;
    }

    public get queryParams(): ReadonlyMap<string, string>
    {
        return this.currentQueryParams;
    }

    public get fragment(): string | null
    {
        return this.currentFragment;
    }

    public get path(): string
    {
        return this.currentPath;
    }

    public navigate(path: string, options?: NavigateOptions): void
    {
        FluffRouter.navigate(path, options);
    }

    public static navigate(path: string, options?: NavigateOptions): void
    {
        const registry = RouteRegistry.getInstance();
        const basePath = registry.getBasePath();
        const normalizedPath = RouteMatcher.normalizePath(path);
        const fullPath = basePath + normalizedPath;

        let url = fullPath;

        if (options?.queryParams)
        {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(options.queryParams))
            {
                searchParams.set(key, value);
            }
            const qs = searchParams.toString();
            if (qs)
            {
                url += '?' + qs;
            }
        }

        if (options?.fragment)
        {
            url += '#' + options.fragment;
        }

        if (options?.replaceState)
        {
            window.history.replaceState(null, '', url);
        }
        else
        {
            window.history.pushState(null, '', url);
        }

        FluffRouter.handleNavigation();
    }

    public back(): void
    {
        window.history.back();
    }

    public forward(): void
    {
        window.history.forward();
    }

    public setQueryParam(key: string, value: string): void
    {
        const url = new URL(window.location.href);
        url.searchParams.set(key, value);
        window.history.replaceState(null, '', url.toString());
        FluffRouter.handleNavigation();
    }

    public removeQueryParam(key: string): void
    {
        const url = new URL(window.location.href);
        url.searchParams.delete(key);
        window.history.replaceState(null, '', url.toString());
        FluffRouter.handleNavigation();
    }

    public setFragment(fragment: string | null): void
    {
        const url = new URL(window.location.href);
        url.hash = fragment ? '#' + fragment : '';
        window.history.replaceState(null, '', url.toString());
        FluffRouter.handleNavigation();
    }

    public onRouteChanged(callback: (event: RouteChangeEvent) => void): Subscription
    {
        return FluffRouter.globalRouteChange.subscribe(callback);
    }

    public onParamsChanged(callback: (params: ReadonlyMap<string, string>) => void): Subscription
    {
        return this.localParamsChange.subscribe(callback);
    }

    public onQueryParamsChanged(callback: (queryParams: ReadonlyMap<string, string>) => void): Subscription
    {
        return FluffRouter.globalQueryParamsChange.subscribe(callback);
    }

    public onFragmentChanged(callback: (fragment: string | null) => void): Subscription
    {
        return FluffRouter.globalFragmentChange.subscribe(callback);
    }

    public syncFromUrl(): void
    {
        const { location } = window;
        this.currentPath = RouteMatcher.normalizePath(location.pathname);
        this.currentQueryParams = FluffRouter.parseQueryParams(location.search);
        this.currentFragment = location.hash ? location.hash.slice(1) : null;
    }

    public updateParams(params: Map<string, string>): void
    {
        this.currentParams = params;
        this.localParamsChange.emit(params);
    }

    public static handleNavigation(): void
    {
        const { location } = window;
        const currentPath = RouteMatcher.normalizePath(location.pathname);
        const queryParams = FluffRouter.parseQueryParams(location.search);
        const fragment = location.hash ? location.hash.slice(1) : null;

        const registry = RouteRegistry.getInstance();
        const resolved = registry.resolve(currentPath);
        const params = resolved?.match.params ?? new Map<string, string>();

        FluffRouter.globalParamsChange.emit(params);
        FluffRouter.globalQueryParamsChange.emit(queryParams);
        FluffRouter.globalFragmentChange.emit(fragment);

        const event: RouteChangeEvent = {
            path: currentPath,
            params,
            queryParams,
            fragment,
            previousPath: null
        };

        FluffRouter.globalRouteChange.emit(event);
    }

    private static linkInterceptionAttached = false;

    public static enableLinkInterception(): void
    {
        if (FluffRouter.linkInterceptionAttached)
        {
            return;
        }
        FluffRouter.linkInterceptionAttached = true;

        document.addEventListener('click', (event: MouseEvent) =>
        {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            {
                return;
            }

            const composed = event.composedPath();
            const target = composed.length > 0 ? composed[0] : event.target;
            if (!(target instanceof Element))
            {
                return;
            }

            const anchor = target.closest('a');
            if (!anchor)
            {
                return;
            }

            if (anchor.hasAttribute('target'))
            {
                return;
            }

            const routerLink = anchor.getAttribute('routerlink');
            if (routerLink)
            {
                event.preventDefault();
                FluffRouter.navigate(routerLink);
                return;
            }

            if (!anchor.href)
            {
                return;
            }

            if (anchor.origin !== window.location.origin)
            {
                return;
            }

            const registry = RouteRegistry.getInstance();
            const basePath = registry.getBasePath();
            if (basePath && !anchor.pathname.startsWith(basePath))
            {
                return;
            }

            event.preventDefault();

            const path = basePath
                ? anchor.pathname.slice(basePath.length) || '/'
                : anchor.pathname;

            let queryParams: Record<string, string> | undefined = undefined;
            if (anchor.search)
            {
                queryParams = {};
                for (const [k, v] of new URLSearchParams(anchor.search).entries())
                {
                    queryParams[k] = v;
                }
            }
            const fragment = anchor.hash ? anchor.hash.slice(1) : undefined;
            FluffRouter.navigate(path, { queryParams, fragment });
        });
    }

    private static ensurePopstateListener(): void
    {
        if (FluffRouter.popstateListenerAttached)
        {
            return;
        }
        FluffRouter.popstateListenerAttached = true;

        window.addEventListener('popstate', () =>
        {
            FluffRouter.handleNavigation();
        });
    }

    public static parseQueryParams(search: string): Map<string, string>
    {
        const map = new Map<string, string>();
        const params = new URLSearchParams(search);
        for (const [key, value] of params.entries())
        {
            map.set(key, value);
        }
        return map;
    }
}
