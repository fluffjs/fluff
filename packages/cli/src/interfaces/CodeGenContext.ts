import type * as parse5 from 'parse5';
import type { CompactBinding } from '../CodeGenerator.js';

export interface CodeGenContext
{
    componentSelector: string;
    generatedFragment: parse5.DefaultTreeAdapterMap['documentFragment'];
    markerConfigs: Map<number, unknown>;
    bindingsMap: Map<string, CompactBinding[]>;
}
