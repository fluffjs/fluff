import type { Scope } from '../runtime/ScopeRegistry.js';
import type { PropertyChain } from './PropertyChain.js';
import type { Subscription } from './Subscription.js';

export interface FluffHostElement extends HTMLElement
{
    __subscribeToExpression?: (deps: PropertyChain[], scope: Scope, callback: () => void, subscriptions: Subscription[]) => void;
    __evaluateExpr?: (exprId: number, locals: Record<string, unknown>) => unknown;
    __applyPipesForController?: (value: unknown, pipes: [number, number[]][], locals: Record<string, unknown>) => unknown;
}
