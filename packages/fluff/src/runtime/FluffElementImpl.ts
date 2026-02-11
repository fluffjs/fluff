import { getDirectiveClass } from '../decorators/Directive.js';
import { getPipeTransform } from '../decorators/Pipe.js';
import type { ElementWithDirectives } from '../interfaces/ElementWithDirectives.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { FluffBase } from './FluffBase.js';
import type { FluffDirective } from './FluffDirective.js';
import { MarkerManager } from './MarkerManager.js';
import type { MarkerConfigEntries, MarkerManagerInterface } from './MarkerManagerInterface.js';
import { getScope, unregisterScope, type Scope } from './ScopeRegistry.js';

export abstract class FluffElement extends FluffBase
{
    private static readonly __globalStyleSheets: CSSStyleSheet[] = [];

    public static __addGlobalStyleSheet(sheet: CSSStyleSheet): void
    {
        FluffElement.__globalStyleSheets.push(sheet);
    }

    protected __pipes: Record<string, (value: unknown, ...args: unknown[]) => unknown> = {};
    protected readonly _shadowRoot: ShadowRoot;
    private _subscriptions: Subscription[] = [];
    private _initialized = false;
    private _pendingInit = false;
    private _markerManager: MarkerManagerInterface | null = null;
    private _markerConfigEntries: MarkerConfigEntries | null = null;
    private _MarkerManagerClass: (new (host: FluffElement, shadowRoot: ShadowRoot) => MarkerManagerInterface) | null = null;
    private _scopeId: string | null = null;

    public constructor()
    {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
        if (FluffElement.__globalStyleSheets.length > 0)
        {
            this._shadowRoot.adoptedStyleSheets = [...FluffElement.__globalStyleSheets];
        }
    }

    public connectedCallback(): void
    {
        if (!this._initialized)
        {
            if (!FluffBase.__areExpressionsReady())
            {
                if (!this._pendingInit)
                {
                    this._pendingInit = true;
                    FluffBase.__addPendingInit((): void =>
                    {
                        this._pendingInit = false;
                        this.connectedCallback();
                    });
                }
                return;
            }

            this._scopeId = this.getAttribute('data-fluff-scope-id');
            if (this._scopeId && !this.__parentScope)
            {
                this.__parentScope = getScope(this._scopeId);
                if (this.__parentScope)
                {
                    this.__loopContext = this.__parentScope.locals;
                }
            }

            const contextAttr = this.getAttribute('data-fluff-loop-context');
            if (contextAttr && Object.keys(this.__loopContext).length === 0)
            {
                try
                {
                    this.__loopContext = JSON.parse(contextAttr);
                }
                catch
                {
                }
            }

            this.__applyPendingProps();

            this.__render();
            this.__setupBindings();
            this.__initHostBindings();

            if (this._scopeId)
            {
                this.__processBindings();
            }
            this._initialized = true;

            if ('onInit' in this && typeof this.onInit === 'function')
            {
                this.onInit();
            }
        }
    }

    public disconnectedCallback(): void
    {
        if ('onDestroy' in this && typeof this.onDestroy === 'function')
        {
            this.onDestroy();
        }

        this.__destroyDirectives();

        if (this._markerManager)
        {
            this._markerManager.cleanup();
            this._markerManager = null;
        }

        for (const sub of this._subscriptions)
        {
            sub.unsubscribe();
        }
        this._subscriptions = [];

        for (const sub of this.__baseSubscriptions)
        {
            sub.unsubscribe();
        }
        this.__baseSubscriptions = [];

        if (this._scopeId)
        {
            unregisterScope(this._scopeId);
            this._scopeId = null;
        }
    }

    private __destroyDirectives(): void
    {
        const elements = this._shadowRoot.querySelectorAll('[data-fluff-directives]');
        for (const el of Array.from(elements))
        {
            const directives = (el as ElementWithDirectives).__fluffDirectives;
            if (directives)
            {
                for (const directive of directives)
                {
                    directive.destroy();
                }
                (el as ElementWithDirectives).__fluffDirectives = undefined;
            }
        }
    }

    public override $watch = (_properties: string[], callback: (changed: string) => void): Subscription =>
    {
        callback('');
        return {
            unsubscribe: (): void =>
            {
            }
        };
    };

    public __processBindingsOnElementPublic(el: Element, scope: Scope, subscriptions?: Subscription[]): void
    {
        this.__processBindingsOnElement(el, scope, subscriptions);
    }

    protected abstract __render(): void;

    protected __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        this.__instantiateDirectives();
        this.__processBindings();
        this.__initializeMarkersInternal();
    }

    private __instantiateDirectives(): void
    {
        const elements = this._shadowRoot.querySelectorAll('[data-fluff-directives]');
        for (const el of Array.from(elements))
        {
            const directiveAttr = el.getAttribute('data-fluff-directives');
            if (!directiveAttr) continue;

            const selectors = directiveAttr.split(',');
            const directives: FluffDirective[] = [];

            for (const selector of selectors)
            {
                const DirectiveClass = getDirectiveClass(selector.trim());
                if (DirectiveClass && el instanceof HTMLElement)
                {
                    const instance = new DirectiveClass();
                    instance.__setHostElement(el);
                    directives.push(instance);
                    instance.initialize();
                }
            }

            if (directives.length > 0)
            {
                (el as ElementWithDirectives).__fluffDirectives = directives;
            }
        }
    }

    protected override __getPipeFn(name: string): ((value: unknown, ...args: unknown[]) => unknown) | undefined
    {
        return this.__pipes[name] ?? getPipeTransform(name);
    }

    protected __getShadowRoot(): ShadowRoot
    {
        return this._shadowRoot;
    }


    protected __setMarkerConfigs(entries: MarkerConfigEntries): void
    {
        this._markerConfigEntries = entries;
    }

    protected __initializeMarkers(MarkerManagerClass: new (host: FluffElement, shadowRoot: ShadowRoot) => MarkerManagerInterface): void
    {
        this._MarkerManagerClass = MarkerManagerClass;
    }

    private __initializeMarkersInternal(): void
    {
        if (!this._markerConfigEntries || !this._MarkerManagerClass) return;

        this._markerManager = new this._MarkerManagerClass(this, this._shadowRoot);
        this._markerManager.initializeFromConfig(this._markerConfigEntries);
    }

    protected override __setChildProperty(el: Element, propName: string, value: unknown): void
    {
        if (el instanceof HTMLElement && el.hasAttribute('x-fluff-component'))
        {
            const tagName = el.tagName.toLowerCase();
            if (customElements.get(tagName) === undefined)
            {
                this.__whenDefined(tagName, () =>
                {
                    this.__setChildProperty(el, propName, value);
                });
                return;
            }
        }

        super.__setChildProperty(el, propName, value);

        const directives = (el as ElementWithDirectives).__fluffDirectives;
        if (directives)
        {
            for (const directive of directives)
            {
                if (propName in directive)
                {
                    Reflect.set(directive, propName, value);
                }
            }
        }
    }

    protected __processBindings(): void
    {
        const elements = this._shadowRoot.querySelectorAll('[data-lid]');
        const scope = this.__getScope();
        for (const el of Array.from(elements))
        {
            const closestComponent = el.closest('[x-fluff-component]');
            if (closestComponent && closestComponent !== el) continue;
            this.__processBindingsOnElement(el, scope);
        }
    }
}
