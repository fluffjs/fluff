import type { Subscription } from '@fluffjs/fluff';
import { FluffRouter } from './FluffRouter.js';
import type { RouteChangeEvent } from './interfaces/RouteChangeEvent.js';
import type { RouteEntry } from './interfaces/RouteEntry.js';
import { RouteRegistry } from './RouteRegistry.js';

export class RouterOutlet extends HTMLElement
{
    private routeSubscription: Subscription | null = null;
    private currentElement: HTMLElement | null = null;
    private currentSelector: string | null = null;
    private parentRouteEntry: RouteEntry | null = null;
    protected currentRouteEntry: RouteEntry | null = null;
    private navigationId = 0;

    public connectedCallback(): void
    {
        const parentOutlet = this.findParentOutlet();
        if (parentOutlet?.currentRouteEntry)
        {
            this.parentRouteEntry = parentOutlet.currentRouteEntry;
        }

        this.routeSubscription = new FluffRouter().onRouteChanged((event: RouteChangeEvent) =>
        {
            this.handleRouteChange(event.path)
                .catch((e: unknown) =>
                {
                    console.error('[RouterOutlet] Navigation error:', e);
                });
        });

        this.handleRouteChange(window.location.pathname)
            .catch((e: unknown) =>
            {
                console.error('[RouterOutlet] Initial navigation error:', e);
            });
    }

    public disconnectedCallback(): void
    {
        if (this.routeSubscription)
        {
            this.routeSubscription.unsubscribe();
            this.routeSubscription = null;
        }
        this.clearCurrentElement();
    }

    public setParentRouteEntry(entry: RouteEntry): void
    {
        this.parentRouteEntry = entry;
    }

    private async handleRouteChange(fullPath: string): Promise<void>
    {
        const thisNav = ++this.navigationId;

        const registry = RouteRegistry.getInstance();
        const routes = this.parentRouteEntry
            ? this.parentRouteEntry.children
            : registry.getRoutes();

        const resolved = this.parentRouteEntry
            ? registry.resolveChildren(fullPath, routes)
            : registry.resolve(fullPath);

        if (!resolved)
        {
            this.clearCurrentElement();
            return;
        }

        const { entry, match } = resolved;

        if (entry.redirectTo !== undefined)
        {
            const router = new FluffRouter();
            router.navigate(entry.redirectTo, { replaceState: true });
            return;
        }

        const queryParams = FluffRouter.parseQueryParams(window.location.search);
        const fragment = window.location.hash ? window.location.hash.slice(1) : null;

        const guardsPass = await registry.runGuards(entry, fullPath, match.params, queryParams, fragment);
        if (thisNav !== this.navigationId)
        {
            return;
        }
        if (!guardsPass)
        {
            return;
        }

        if (this.currentSelector === entry.selector)
        {
            this.updateExistingRouterInstance(match.params);
            return;
        }

        this.clearCurrentElement();

        const ComponentClass = await entry.componentLoader();
        if (thisNav !== this.navigationId)
        {
            return;
        }

        if (!customElements.get(entry.selector))
        {
            customElements.define(entry.selector, ComponentClass);
        }

        const element = document.createElement(entry.selector);
        this.currentElement = element;
        this.currentSelector = entry.selector;
        this.currentRouteEntry = entry;

        this.injectRouterInstance(element, match.params);

        this.appendChild(element);
    }

    private updateExistingRouterInstance(params: Map<string, string>): void
    {
        if (!this.currentElement)
        {
            return;
        }

        const routerProp = this.findRouterProperty(this.currentElement);
        if (routerProp)
        {
            routerProp.updateParams(params);
            routerProp.syncFromUrl();
        }
    }

    private injectRouterInstance(element: HTMLElement, params: Map<string, string>): void
    {
        const routerFieldName = this.getRouterFieldName(element);
        if (routerFieldName)
        {
            const router = new FluffRouter();
            router.updateParams(params);
            Reflect.set(element, routerFieldName, router);
        }
    }

    private findRouterProperty(element: HTMLElement): FluffRouter | null
    {
        const fieldName = this.getRouterFieldName(element);
        if (fieldName)
        {
            const value: unknown = Reflect.get(element, fieldName);
            if (value instanceof FluffRouter)
            {
                return value;
            }
        }
        return null;
    }

    private getRouterFieldName(element: HTMLElement): string | null
    {
        const fieldName: unknown = Reflect.get(element.constructor, '__routerField');
        if (typeof fieldName === 'string')
        {
            return fieldName;
        }
        return null;
    }

    private clearCurrentElement(): void
    {
        if (this.currentElement)
        {
            this.currentElement.remove();
            this.currentElement = null;
            this.currentSelector = null;
            this.currentRouteEntry = null;
        }
    }

    private findParentOutlet(): RouterOutlet | null
    {
        let node: Node | null = this.parentNode;
        while (node)
        {
            if (node instanceof RouterOutlet)
            {
                return node;
            }
            if (node instanceof ShadowRoot)
            {
                node = node.host;
            }
            else
            {
                node = node.parentNode;
            }
        }
        return null;
    }
}
