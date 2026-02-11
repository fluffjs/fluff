import type * as parse5 from 'parse5';
import type { FluffConfig } from './FluffConfigInterface.js';
import type { DiscoveryInfo } from './DiscoveryInfo.js';
import type { ParsedTemplate } from './ParsedTemplate.js';
import type { CodeGenContext } from './CodeGenContext.js';
import type { ClassTransformContext } from './ClassTransformContext.js';
import type { EntryPointContext } from './EntryPointContext.js';
import type { PluginHookName } from './PluginHookName.js';
import type { PluginCustomTable } from './PluginCustomTable.js';
import type { ScopeElementConfig } from './ScopeElementConfig.js';

export interface FluffPlugin
{
    readonly name: string;

    dependencies?: Partial<Record<PluginHookName, string[]>>;

    afterConfig?: (config: FluffConfig, pluginConfig: Record<string, unknown>) => void | Promise<void>;

    afterDiscovery?: (discovery: DiscoveryInfo) => void | Promise<void>;

    beforeTemplatePreProcess?: (
        fragment: parse5.DefaultTreeAdapterMap['documentFragment'],
        componentSelector: string
    ) => void | Promise<void>;

    afterTemplateParse?: (
        template: ParsedTemplate,
        componentSelector: string
    ) => void | Promise<void>;

    afterCodeGeneration?: (context: CodeGenContext) => void | Promise<void>;

    beforeClassTransform?: (context: ClassTransformContext) => void | Promise<void>;

    modifyEntryPoint?: (context: EntryPointContext) => void | Promise<void>;

    modifyIndexHtml?: (
        document: parse5.DefaultTreeAdapterMap['document']
    ) => void | Promise<void>;

    registerRuntimeImports?: () => string[];

    registerCustomTables?: () => PluginCustomTable[];

    registerScopeElements?: () => ScopeElementConfig[];
}
