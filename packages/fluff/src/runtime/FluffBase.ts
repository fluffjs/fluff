import type { PropertyChain } from '../interfaces/PropertyChain.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { Property } from '../utils/Property.js';
import { Publisher } from '../utils/Publisher.js';
import type { Scope } from './ScopeRegistry.js';
import type { ElementWithDirectives } from '../interfaces/ElementWithDirectives.js';

export type ExpressionFn = (t: unknown, l: Record<string, unknown>) => unknown;
export type HandlerFn = (t: unknown, l: Record<string, unknown>, e: unknown) => void;

interface ElementWithStyle extends Element
{
    style: CSSStyleDeclaration;
}

/**
 * Compact Binding Format
 *
 * Bindings are consumed as tuples to minimize bundle size. All strings are
 * stored in a global string table (FluffBase.__s) and referenced by index.
 *
 * Format: [nameIdx, bindType, deps, id, extras?]
 *
 * [0] nameIdx:  Index into __s for the binding target name (e.g., "value", "click")
 * [1] bindType: Numeric binding type: 0=property, 1=event, 2=two-way, 3=class, 4=style, 5=ref
 * [2] deps:     Array of dependency chains (CompactDep[]) or null. Each dep is either:
 *               - A single number index (simple property, e.g. "foo")
 *               - An array of number indices (nested chain, e.g. ["device", "name"])
 * [3] id:       Expression ID (property/two-way/class/style) or Handler ID (event), or null
 * [4] extras:   Optional object with additional binding metadata:
 *               - t: Target property name string for two-way bindings
 *               - s: Subscribe source property name string
 *               - p: Pipes as [pipeNameIdx, argExprIds[]][] (compact pipe format)
 *
 * The string table is set via FluffBase.__setExpressionTable(exprs, handlers, strings).
 */
type CompactDep = number | number[];

export type CompactBinding = [
    number,              // [0] nameIdx
    number,              // [1] bindType: 0=property, 1=event, 2=two-way, 3=class, 4=style, 5=ref
    CompactDep[] | null, // [2] deps
    number | null,       // [3] exprId or handlerId
    { t?: string; s?: string; p?: [number, number[]][] }?  // [4] extras
];

/**
 * Compact Marker Config Format (Decoder)
 *
 * Marker configs use the same string table as bindings. Type is numeric:
 * 0=if, 1=for, 2=text, 3=switch, 4=break
 *
 * Format varies by type:
 * - if:     [0, branches[]] where branch = [exprId?, deps?]
 * - for:    [1, iteratorIdx, iterableExprId, hasEmpty, deps?, trackByIdx?]
 * - text:   [2, exprId, deps?, pipes?]
 * - switch: [3, expressionExprId, deps?, cases[]]
 * - break:  [4]
 *
 * deps are interned as CompactDep[] (same as bindings)
 * pipes are [pipeNameIdx, argExprIds[]][]
 */
// [0, branches[]]  —  branch = [exprId?, deps?] or [] for else
export type CompactIfConfig = [0, ([number | null, CompactDep[] | null] | [])[]];  // if

// [1, iteratorNameIdx, iterableExprId, hasEmpty, deps, trackByNameIdx]
export type CompactForConfig = [1, number, number, boolean, CompactDep[] | null, number | null];  // for

// [2, exprId, deps, pipes]  —  pipes = [pipeNameIdx, argExprIds[]][]
export type CompactTextConfig = [2, number, CompactDep[] | null, [number, number[]][] | null];  // text

// [3, exprId, deps, cases[]]  —  case = [isDefault, fallthrough, valueExprId]
export type CompactSwitchConfig = [3, number, CompactDep[] | null, [boolean, boolean, number | null][]];  // switch

// [4]  —  no additional data
export type CompactBreakConfig = [4];  // break

export type CompactMarkerConfig = CompactIfConfig | CompactForConfig | CompactTextConfig | CompactSwitchConfig | CompactBreakConfig;

export abstract class FluffBase extends HTMLElement
{
    public static __e: ExpressionFn[] = [];
    public static __h: HandlerFn[] = [];
    public static __s: string[] = [];
    public static __bindings: Record<string, CompactBinding[]> = {};
    private static __expressionsReady = false;
    private static readonly __pendingInitCallbacks: (() => void)[] = [];

    public static __setExpressionTable(expressions: ExpressionFn[], handlers: HandlerFn[], strings?: string[]): void
    {
        FluffBase.__e = expressions;
        FluffBase.__h = handlers;
        if (strings)
        {
            FluffBase.__s = strings;
        }
        FluffBase.__expressionsReady = true;

        const pending = FluffBase.__pendingInitCallbacks.splice(0, FluffBase.__pendingInitCallbacks.length);
        for (const callback of pending)
        {
            callback();
        }
    }

    public static __decodeDep(dep: number | number[]): string | string[]
    {
        if (Array.isArray(dep))
        {
            return dep.map(idx => FluffBase.__s[idx]);
        }
        return FluffBase.__s[dep];
    }

    public static __decodeDeps(deps: (number | number[])[] | null): (string | string[])[] | undefined
    {
        if (!deps) return undefined;
        return deps.map(d => FluffBase.__decodeDep(d));
    }

    public static __areExpressionsReady(): boolean
    {
        return FluffBase.__expressionsReady;
    }

    public static __addPendingInit(callback: () => void): void
    {
        FluffBase.__pendingInitCallbacks.push(callback);
    }

    public __parentScope?: Scope;
    public __loopContext: Record<string, unknown> = {};
    protected __baseSubscriptions: Subscription[] = [];

    public __getScope(): Scope
    {
        return {
            host: this,
            locals: this.__loopContext,
            parent: this.__parentScope
        };
    }

    public __subscribeToExpression(deps: PropertyChain[], scope: Scope, callback: () => void, subscriptions: Subscription[]): void
    {
        this.__subscribeToExpressionInScope(deps, scope, callback, subscriptions);
    }

    public __evaluateExpr(exprId: number, locals: Record<string, unknown>): unknown
    {
        const fn = this.__getCompiledExprFn(exprId);
        try
        {
            return fn(this, locals);
        }
        catch
        {
            return undefined;
        }
    }

    public __applyPipesForController(value: unknown, pipes: [number, number[]][], locals: Record<string, unknown>): unknown
    {
        let result = value;
        if (result instanceof Property)
        {
            result = result.getValue();
        }
        for (const [nameIdx, argExprIds] of pipes)
        {
            const name = FluffBase.__s[nameIdx];
            const pipeFn = this.__getPipeFn(name);
            if (!pipeFn)
            {
                console.warn(`Pipe "${name}" not found`);
                continue;
            }
            const args = argExprIds.map(id => this.__getCompiledExprFn(id)(this, locals));
            result = pipeFn(result, ...args);
        }
        return result;
    }

    protected __processBindingsOnElement(el: Element, scope: Scope, subscriptions?: Subscription[]): void
    {
        const lid = el.getAttribute('data-lid');
        if (!lid) return;

        const bindings = this.__getBindingsForLid(lid);
        if (!bindings || bindings.length === 0) return;

        for (const binding of bindings)
        {
            this.__applyBindingWithScope(el, binding, scope, subscriptions);
        }
    }

    private __getBindingsForLid(lid: string): CompactBinding[] | undefined
    {
        const ctor: unknown = this.constructor;
        if (typeof ctor === 'function')
        {
            const bindings: unknown = Reflect.get(ctor, '__bindings');
            if (this.__isRecord(bindings) && lid in bindings)
            {
                const lidBindings: unknown = bindings[lid];
                if (this.__isCompactBindingArray(lidBindings))
                {
                    return lidBindings;
                }
            }
        }
        return undefined;
    }

    private __isCompactBindingArray(value: unknown): value is CompactBinding[]
    {
        return Array.isArray(value);
    }

    // CompactBinding[1] type dispatch: 0=property, 1=event, 2=two-way, 3=class, 4=style, 5=ref
    protected __applyBindingWithScope(el: Element, binding: CompactBinding, scope: Scope, subscriptions?: Subscription[]): void
    {
        switch (binding[1])
        {
            case 0:
                this.__applyPropertyBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 1:
                this.__applyEventBindingWithScope(el, binding, scope);
                break;
            case 2:
                this.__applyTwoWayBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 3:
                this.__applyClassBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 4:
                this.__applyStyleBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 5:
                break;
        }
    }

    protected __getCompiledExprFn(exprId: number): ExpressionFn
    {
        const fn = FluffBase.__e[exprId];
        if (typeof fn !== 'function')
        {
            throw new Error(`Missing compiled expression function for exprId ${exprId}`);
        }
        return fn;
    }

    protected __getCompiledHandlerFn(handlerId: number): HandlerFn
    {
        const fn = FluffBase.__h[handlerId];
        if (typeof fn !== 'function')
        {
            throw new Error(`Missing compiled handler function for handlerId ${handlerId}`);
        }
        return fn;
    }

    protected __getPipeFn(_name: string): ((value: unknown, ...args: unknown[]) => unknown) | undefined
    {
        return undefined;
    }

    protected __subscribeToExpressionInScope(deps: PropertyChain[] | undefined, scope: Scope, callback: () => void, subscriptions?: Subscription[]): void
    {
        if (!deps) return;

        const addSub = (sub: Subscription): void =>
        {
            if (subscriptions)
            {
                subscriptions.push(sub);
            }
            else
            {
                this.__baseSubscriptions.push(sub);
            }
        };

        for (const dep of deps)
        {
            if (Array.isArray(dep))
            {
                this.__subscribeToPropertyChain(dep, scope, callback, addSub);
            }
            else
            {
                const reactiveProp = this.__getReactivePropFromScope(dep, scope);
                if (reactiveProp)
                {
                    addSub(reactiveProp.onChange.subscribe(callback));
                }
                else if (!(dep in scope.locals) && !(dep in scope.host))
                {
                    console.warn(`Binding dependency "${dep}" not found on component ${scope.host.constructor.name}`);
                }
            }
        }
    }

    private __subscribeToPropertyChain(chain: string[], scope: Scope, callback: () => void, addSub: (sub: Subscription) => void): void
    {
        if (chain.length === 0) return;

        const [first, ...rest] = chain;

        const reactiveProp = this.__getReactivePropFromScope(first, scope);
        if (reactiveProp)
        {
            this.__subscribeToProp(reactiveProp, rest, callback, addSub);
        }
        else if (first in scope.locals)
        {
            const localValue: unknown = scope.locals[first];
            if (localValue !== null && localValue !== undefined && rest.length > 0)
            {
                this.__subscribeToNestedChain(localValue, rest, callback, addSub);
            }
        }
        else if (!(first in scope.host))
        {
            console.warn(`Binding dependency "${first}" not found on component ${scope.host.constructor.name}`);
        }
    }

    private __subscribeToProp(prop: Property<unknown>, rest: string[], callback: () => void, addSub: (sub: Subscription) => void): void
    {
        if (rest.length === 0)
        {
            addSub(prop.onChange.subscribe(callback));
            return;
        }

        let nestedSubs: Subscription[] = [];

        const resubscribeNested = (): void =>
        {
            for (const sub of nestedSubs)
            {
                sub.unsubscribe();
            }
            nestedSubs = [];

            const currentValue: unknown = prop.getValue();
            if (currentValue !== null && currentValue !== undefined)
            {
                this.__subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                {
                    nestedSubs.push(sub);
                    addSub(sub);
                });
            }

            callback();
        };

        addSub(prop.onChange.subscribe(resubscribeNested));

        const currentValue: unknown = prop.getValue();
        if (currentValue !== null && currentValue !== undefined)
        {
            this.__subscribeToNestedChain(currentValue, rest, callback, (sub) =>
            {
                nestedSubs.push(sub);
                addSub(sub);
            });
        }
    }

    private __subscribeToNestedChain(obj: unknown, chain: string[], callback: () => void, addSub: (sub: Subscription) => void): void
    {
        if (chain.length === 0 || obj === null || obj === undefined) return;

        const [first, ...rest] = chain;

        const prop: unknown = Reflect.get(obj as object, first);

        if (prop instanceof Property)
        {
            this.__subscribeToProp(prop, rest, callback, addSub);
        }
        else if (rest.length > 0 && prop !== null && prop !== undefined)
        {
            this.__subscribeToNestedChain(prop, rest, callback, addSub);
        }
    }

    protected __getReactivePropFromScope(propName: string, scope: Scope): Property<unknown> | undefined
    {
        if (propName in scope.locals)
        {
            return undefined;
        }
        const key = `__${propName}`;
        if (key in scope.host)
        {
            const candidate: unknown = Reflect.get(scope.host, key);
            if (candidate instanceof Property)
            {
                return candidate;
            }
        }
        if (scope.parent)
        {
            return this.__getReactivePropFromScope(propName, scope.parent);
        }
        return undefined;
    }

    protected __setChildProperty(el: Element, propName: string, value: unknown): void
    {
        const prop: unknown = Reflect.get(el, propName);

        if (prop instanceof Property)
        {
            prop.setValue(value, true);
        }
        else if (el instanceof FluffBase)
        {
            Reflect.set(el, propName, value);
        }
        else if (propName in el && el instanceof HTMLElement)
        {
            Reflect.set(el, propName, this.__unwrap(value));
        }
        else
        {
            el.setAttribute(propName, String(this.__unwrap(value)));
        }
    }

    private __unwrap(value: unknown): unknown
    {
        if (value instanceof Property)
        {
            return value.getValue();
        }
        return value;
    }

    // CompactBinding: [nameIdx, type, deps, exprId, extras?]
    private __applyPropertyBindingWithScope(el: Element, binding: CompactBinding, scope: Scope, subscriptions?: Subscription[]): void
    {
        const [nameIdx, , compactDeps, exprId, extras] = binding;
        const name = FluffBase.__s[nameIdx];
        const deps = FluffBase.__decodeDeps(compactDeps);

        const tagName = el.tagName.toLowerCase();
        const isCustomElement = customElements.get(tagName) !== undefined;
        const update = (): void =>
        {
            try
            {
                if (typeof exprId !== 'number')
                {
                    throw new Error(`Binding for ${name} is missing exprId`);
                }
                const fn = this.__getCompiledExprFn(exprId);
                let value: unknown = fn(this, scope.locals);

                if (extras?.p && extras.p.length > 0)
                {
                    value = this.__applyPipesForController(value, extras.p, scope.locals);
                }

                this.__setChildProperty(el, name, value);
            }
            catch(e)
            {
                console.error('Property binding error:', e);
            }
        };

        this.__subscribeToExpressionInScope(deps, scope, update, subscriptions);

        if (extras?.s)
        {
            this.__subscribeToExpressionInScope([extras.s], scope, update, subscriptions);
        }

        if (isCustomElement)
        {
            if (el instanceof FluffBase)
            {
                update();
            }
            else
            {
                this.__whenDefined(tagName, () =>
                {
                    if (el instanceof FluffBase)
                    {
                        update();
                    }
                    else
                    {
                        console.warn(`Element <${tagName}> is not a FluffBase instance after whenDefined - binding for "${name}" skipped`);
                    }
                });
            }
        }
        else
        {
            update();
        }
    }

    // CompactBinding: [nameIdx, type, deps, handlerId, extras?]
    private __applyEventBindingWithScope(el: Element, binding: CompactBinding, scope: Scope): void
    {
        const [nameIdx, , , handlerId] = binding;
        const name = FluffBase.__s[nameIdx];

        const boundKey = `__fluff_event_${name}`;
        if (Reflect.has(el, boundKey)) return;
        Reflect.set(el, boundKey, true);

        if (typeof handlerId !== 'number')
        {
            throw new Error(`Event binding for ${name} is missing handlerId`);
        }
        const handlerFn = this.__getCompiledHandlerFn(handlerId);

        const hasDirectives = el.hasAttribute('data-fluff-directives');
        if (el.hasAttribute('x-fluff-component') || hasDirectives)
        {
            this.__applyOutputBinding(el, name, handlerFn, scope);
        }
        else
        {
            el.addEventListener(name, (event: Event) =>
            {
                try
                {
                    handlerFn(this, scope.locals, event);
                }
                catch(e)
                {
                    console.error('Event binding error:', e);
                }
            });
        }
    }

    private __applyOutputBinding(el: Element, outputName: string, handlerFn: HandlerFn, scope: Scope): void
    {
        const subscribeToPublisher = (publisher: unknown): boolean =>
        {
            if (publisher instanceof Publisher)
            {
                const sub = publisher.subscribe((value: unknown) =>
                {
                    try
                    {
                        handlerFn(this, scope.locals, value);
                    }
                    catch(e)
                    {
                        console.error('Output binding error:', e);
                    }
                });
                this.__baseSubscriptions.push(sub);
                return true;
            }
            return false;
        };

        const subscribeToElement = (): boolean =>
        {
            const publisher: unknown = Reflect.get(el, outputName);
            return subscribeToPublisher(publisher);
        };

        const subscribeToDirectives = (): boolean =>
        {
            let subscribed = false;
            const directives = (el as ElementWithDirectives).__fluffDirectives;
            if (directives)
            {
                for (const directive of directives)
                {
                    const directivePublisher: unknown = Reflect.get(directive, outputName);
                    if (subscribeToPublisher(directivePublisher))
                    {
                        subscribed = true;
                    }
                }
            }
            return subscribed;
        };

        subscribeToDirectives();

        if (!subscribeToElement())
        {
            const tagName = el.tagName.toLowerCase();
            if (tagName.includes('-'))
            {
                this.__whenDefined(tagName, () =>
                {
                    subscribeToElement();
                });
            }
        }
    }

    protected __whenDefined(tagName: string, callback: () => void): void
    {
        customElements.whenDefined(tagName)
            .then(callback)
            .catch(console.error);
    }


    // CompactBinding: [nameIdx, type, deps, exprId, extras?] — extras.t = targetProp for two-way
    private __applyTwoWayBindingWithScope(el: Element, binding: CompactBinding, scope: Scope, subscriptions?: Subscription[]): void
    {
        this.__applyPropertyBindingWithScope(el, binding, scope, subscriptions);

        const name = FluffBase.__s[binding[0]];
        const targetProp = binding[4]?.t;
        if (typeof targetProp !== 'string' || targetProp.length === 0)
        {
            throw new Error(`Two-way binding for ${name} is missing targetProp`);
        }
        const reactiveProp = this.__getReactivePropFromScope(targetProp, scope);

        const childPropCandidate = Reflect.get(el, name);
        if (reactiveProp && childPropCandidate instanceof Property)
        {
            const sub = childPropCandidate.onChange.subscribe((val) =>
            {
                reactiveProp.setValue(val, true);
            });
            if (subscriptions)
            {
                subscriptions.push(sub);
            }
            else
            {
                this.__baseSubscriptions.push(sub);
            }
        }
    }

    // CompactBinding: [nameIdx, type, deps, exprId]
    private __applyClassBindingWithScope(el: Element, binding: CompactBinding, scope: Scope, subscriptions?: Subscription[]): void
    {
        const [nameIdx, , compactDeps, exprId] = binding;
        const name = FluffBase.__s[nameIdx];
        const deps = FluffBase.__decodeDeps(compactDeps);

        const update = (): void =>
        {
            try
            {
                if (typeof exprId !== 'number')
                {
                    throw new Error(`Class binding for ${name} is missing exprId`);
                }
                const fn = this.__getCompiledExprFn(exprId);
                const value = this.__unwrap(fn(this, scope.locals));
                if (value)
                {
                    el.classList.add(name);
                }
                else
                {
                    el.classList.remove(name);
                }
            }
            catch(e)
            {
                console.error('Class binding error:', e);
            }
        };

        this.__subscribeToExpressionInScope(deps, scope, update, subscriptions);
        update();
    }

    // CompactBinding: [nameIdx, type, deps, exprId]
    private __applyStyleBindingWithScope(el: Element, binding: CompactBinding, scope: Scope, subscriptions?: Subscription[]): void
    {
        const [nameIdx, , compactDeps, exprId] = binding;
        const name = FluffBase.__s[nameIdx];
        const deps = FluffBase.__decodeDeps(compactDeps);

        const update = (): void =>
        {
            try
            {
                if (typeof exprId !== 'number')
                {
                    throw new Error(`Style binding for ${name} is missing exprId`);
                }
                const fn = this.__getCompiledExprFn(exprId);
                const value = this.__unwrap(fn(this, scope.locals));
                if (this.__hasStyle(el))
                {
                    el.style.setProperty(name, String(value));
                }
            }
            catch(e)
            {
                console.error('Style binding error:', e);
            }
        };

        this.__subscribeToExpressionInScope(deps, scope, update, subscriptions);
        update();
    }

    private __hasStyle(el: Element): el is ElementWithStyle
    {
        return 'style' in el;
    }

    protected __createProp<T>(nameOrIdx: string | number, options: T | { initialValue: T; [key: string]: unknown }): Property<T>
    {
        const name = typeof nameOrIdx === 'number' ? FluffBase.__s[nameOrIdx] : nameOrIdx;
        const prop = new Property<T>(options);
        Object.defineProperty(this, name, {
            get(): T | null
            {
                return prop.getValue();
            },
            set(v: T): void
            {
                prop.setValue(v);
            },
            enumerable: true,
            configurable: true
        });
        return prop;
    }

    protected __defineClassHostBinding(name: string, className: string, privateName: string): void
    {
        const host = this.__getHostElement();
        Object.defineProperty(this, name, {
            get: (): boolean => Boolean(Reflect.get(this, privateName)),
            set: (v: boolean): void =>
            {
                Reflect.set(this, privateName, v);
                if (v)
                {
                    host.classList.add(className);
                }
                else
                {
                    host.classList.remove(className);
                }
            },
            enumerable: true,
            configurable: true
        });
    }

    protected __applyPendingProps(): void
    {
        const existing: unknown = Reflect.get(this, '__pendingProps');
        if (!this.__isRecord(existing))
        {
            return;
        }
        for (const [propName, value] of Object.entries(existing))
        {
            const key = `__${propName}`;
            if (key in this)
            {
                const prop: unknown = Reflect.get(this, key);
                if (prop instanceof Property)
                {
                    prop.setValue(value, true);
                }
            }
            else if (propName in this)
            {
                Reflect.set(this, propName, value);
            }
        }

        Reflect.deleteProperty(this, '__pendingProps');
    }

    protected __isRecord(value: unknown): value is Record<string, unknown>
    {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    protected __getHostElement(): HTMLElement
    {
        return this;
    }

    protected __initHostBindings(): void
    {
    }
}
