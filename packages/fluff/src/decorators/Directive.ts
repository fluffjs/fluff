import type { FluffDirective } from '../runtime/FluffDirective.js';

type Constructor = new (...args: unknown[]) => object;
export type DirectiveConstructor = new (...args: unknown[]) => FluffDirective;

export interface DirectiveConfig
{
    selector: string;
}

export interface DirectiveMetadata extends DirectiveConfig
{
    inputs: Map<string, string>;
    outputs: Map<string, string>;
}

const directiveRegistry = new Map<string, DirectiveConstructor>();
const directiveMetadataRegistry = new Map<Constructor, DirectiveMetadata>();

export function Directive(config: DirectiveConfig): <T extends Constructor>(target: T) => T
{
    return function <T extends Constructor>(target: T): T
    {
        const metadata: DirectiveMetadata = {
            ...config, inputs: new Map(), outputs: new Map()
        };
        directiveMetadataRegistry.set(target, metadata);

        return target;
    };
}

export function getDirectiveMetadata(target: Constructor): DirectiveMetadata | undefined
{
    return directiveMetadataRegistry.get(target);
}

export function getDirectiveClass(selector: string): DirectiveConstructor | undefined
{
    return directiveRegistry.get(selector);
}

export function getDirectiveSelectors(): string[]
{
    return Array.from(directiveRegistry.keys());
}

export function __registerDirective(selector: string, directiveClass: DirectiveConstructor): void
{
    directiveRegistry.set(selector, directiveClass);
}
