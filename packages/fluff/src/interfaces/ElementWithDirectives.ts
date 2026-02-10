import type { FluffDirective } from '../runtime/FluffDirective.js';

export interface ElementWithDirectives extends Element
{
    __fluffDirectives?: FluffDirective[];
}
