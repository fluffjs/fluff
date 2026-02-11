import type * as parse5 from 'parse5';
import { CodeGenerator } from './CodeGenerator.js';
import type { ClassTransformContext } from './interfaces/ClassTransformContext.js';
import type { CodeGenContext } from './interfaces/CodeGenContext.js';
import type { DiscoveryInfo } from './interfaces/DiscoveryInfo.js';
import type { EntryPointContext } from './interfaces/EntryPointContext.js';
import type { FluffConfig } from './interfaces/FluffConfigInterface.js';
import type { FluffPlugin } from './interfaces/FluffPlugin.js';
import type { ParsedTemplate } from './interfaces/ParsedTemplate.js';
import type { PluginCustomTable } from './interfaces/PluginCustomTable.js';
import type { PluginHookName } from './interfaces/PluginHookName.js';
import type { ScopeElementConfig } from './interfaces/ScopeElementConfig.js';

interface ResolvedHookEntry
{
    pluginName: string;
    hookName: PluginHookName;
    plugin: FluffPlugin;
}

export class PluginManager
{
    private readonly plugins: FluffPlugin[] = [];
    private readonly pluginsByName = new Map<string, FluffPlugin>();
    private readonly hookExecutionOrder = new Map<PluginHookName, ResolvedHookEntry[]>();

    public registerPlugin(plugin: FluffPlugin): void
    {
        if (this.pluginsByName.has(plugin.name))
        {
            throw new Error(`Plugin '${plugin.name}' is already registered`);
        }
        this.plugins.push(plugin);
        this.pluginsByName.set(plugin.name, plugin);
    }

    public resolveExecutionOrder(): void
    {
        this.hookExecutionOrder.clear();

        const allHookNames: PluginHookName[] = [
            'afterConfig',
            'afterDiscovery',
            'beforeTemplatePreProcess',
            'afterTemplateParse',
            'afterCodeGeneration',
            'beforeClassTransform',
            'modifyEntryPoint',
            'modifyIndexHtml',
            'registerRuntimeImports',
            'registerCustomTables',
            'registerScopeElements'
        ];

        for (const hookName of allHookNames)
        {
            const entries = this.resolveHookOrder(hookName);
            this.hookExecutionOrder.set(hookName, entries);
        }
    }

    private resolveHookOrder(hookName: PluginHookName): ResolvedHookEntry[]
    {
        const participants: ResolvedHookEntry[] = [];
        for (const plugin of this.plugins)
        {
            if (plugin[hookName])
            {
                participants.push({ pluginName: plugin.name, hookName, plugin });
            }
        }

        if (participants.length <= 1)
        {
            return participants;
        }

        const graph = new Map<string, Set<string>>();
        for (const entry of participants)
        {
            graph.set(entry.pluginName, new Set());
        }

        for (const entry of participants)
        {
            const deps = entry.plugin.dependencies?.[hookName];
            if (!deps)
            {
                continue;
            }

            for (const depSpec of deps)
            {
                const parsed = this.parseDependency(depSpec);

                if (parsed.pluginName && parsed.hookName)
                {
                    if (parsed.hookName === hookName && graph.has(parsed.pluginName))
                    {
                        graph.get(entry.pluginName)?.add(parsed.pluginName);
                    }
                }
                else if (parsed.pluginName && !parsed.hookName)
                {
                    if (graph.has(parsed.pluginName))
                    {
                        graph.get(entry.pluginName)?.add(parsed.pluginName);
                    }
                }
                else if (!parsed.pluginName && parsed.hookName)
                {
                    if (parsed.hookName === hookName)
                    {
                        for (const other of participants)
                        {
                            if (other.pluginName !== entry.pluginName)
                            {
                                graph.get(entry.pluginName)?.add(other.pluginName);
                            }
                        }
                    }
                }
            }
        }

        return this.topologicalSort(participants, graph);
    }

    private parseDependency(spec: string): { pluginName?: string; hookName?: string }
    {
        if (spec.startsWith(':'))
        {
            return { hookName: spec.slice(1) };
        }

        const colonIndex = spec.indexOf(':');
        if (colonIndex === -1)
        {
            return { pluginName: spec };
        }

        return {
            pluginName: spec.slice(0, colonIndex),
            hookName: spec.slice(colonIndex + 1)
        };
    }

    private topologicalSort(
        entries: ResolvedHookEntry[],
        graph: Map<string, Set<string>>
    ): ResolvedHookEntry[]
    {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const sorted: string[] = [];

        const visit = (name: string): void =>
        {
            if (visited.has(name))
            {
                return;
            }

            if (visiting.has(name))
            {
                const cycle = Array.from(visiting).join(' -> ') + ' -> ' + name;
                throw new Error(
                    `Circular plugin dependency detected: ${cycle}`
                );
            }

            visiting.add(name);

            const deps = graph.get(name);
            if (deps)
            {
                for (const dep of deps)
                {
                    visit(dep);
                }
            }

            visiting.delete(name);
            visited.add(name);
            sorted.push(name);
        };

        for (const entry of entries)
        {
            visit(entry.pluginName);
        }

        const entryMap = new Map<string, ResolvedHookEntry>();
        for (const entry of entries)
        {
            entryMap.set(entry.pluginName, entry);
        }

        const result: ResolvedHookEntry[] = [];
        for (const name of sorted)
        {
            const entry = entryMap.get(name);
            if (entry)
            {
                result.push(entry);
            }
        }

        return result;
    }

    private getOrderedEntries(hookName: PluginHookName): ResolvedHookEntry[]
    {
        return this.hookExecutionOrder.get(hookName) ?? [];
    }

    public async runAfterConfig(config: FluffConfig, pluginConfigs: Record<string, Record<string, unknown>>): Promise<void>
    {
        for (const entry of this.getOrderedEntries('afterConfig'))
        {
            const pluginConfig = pluginConfigs[entry.pluginName] ?? {};
            const hook = entry.plugin.afterConfig;
            if (hook)
            {
                await hook.call(entry.plugin, config, pluginConfig);
            }
        }
    }

    public async runAfterDiscovery(discovery: DiscoveryInfo): Promise<void>
    {
        await this.runHook('afterDiscovery', async(plugin) => plugin.afterDiscovery?.(discovery));
    }

    public async runBeforeTemplatePreProcess(
        fragment: parse5.DefaultTreeAdapterMap['documentFragment'],
        componentSelector: string
    ): Promise<void>
    {
        await this.runHook('beforeTemplatePreProcess', async(plugin) => plugin.beforeTemplatePreProcess?.(fragment, componentSelector));
    }

    public async runAfterTemplateParse(
        template: ParsedTemplate,
        componentSelector: string
    ): Promise<void>
    {
        await this.runHook('afterTemplateParse', async(plugin) => plugin.afterTemplateParse?.(template, componentSelector));
    }

    public async runAfterCodeGeneration(context: CodeGenContext): Promise<void>
    {
        await this.runHook('afterCodeGeneration', async(plugin) => plugin.afterCodeGeneration?.(context));
    }

    public async runBeforeClassTransform(context: ClassTransformContext): Promise<void>
    {
        await this.runHook('beforeClassTransform', async(plugin) => plugin.beforeClassTransform?.(context));
    }

    public async runModifyEntryPoint(context: EntryPointContext): Promise<void>
    {
        await this.runHook('modifyEntryPoint', async(plugin) => plugin.modifyEntryPoint?.(context));
    }

    public async runModifyIndexHtml(
        document: parse5.DefaultTreeAdapterMap['document']
    ): Promise<void>
    {
        await this.runHook('modifyIndexHtml', async(plugin) => plugin.modifyIndexHtml?.(document));
    }

    private async runHook(hookName: PluginHookName, invoke: (plugin: FluffPlugin) => void | Promise<void>): Promise<void>
    {
        for (const entry of this.getOrderedEntries(hookName))
        {
            await invoke(entry.plugin);
        }
    }

    public collectRuntimeImports(): string[]
    {
        const imports: string[] = [];
        for (const entry of this.getOrderedEntries('registerRuntimeImports'))
        {
            const hook = entry.plugin.registerRuntimeImports;
            if (hook)
            {
                imports.push(...hook.call(entry.plugin));
            }
        }
        return imports;
    }

    public collectCustomTables(): PluginCustomTable[]
    {
        const tables: PluginCustomTable[] = [];
        for (const entry of this.getOrderedEntries('registerCustomTables'))
        {
            const hook = entry.plugin.registerCustomTables;
            if (hook)
            {
                tables.push(...hook.call(entry.plugin));
            }
        }
        return tables;
    }

    public collectScopeElements(): ScopeElementConfig[]
    {
        const elements: ScopeElementConfig[] = [];
        for (const entry of this.getOrderedEntries('registerScopeElements'))
        {
            const hook = entry.plugin.registerScopeElements;
            if (hook)
            {
                elements.push(...hook.call(entry.plugin));
            }
        }
        return elements;
    }

    public internString(value: string): number
    {
        return CodeGenerator.internString(value);
    }

    public internExpression(expr: string): number
    {
        return CodeGenerator.internExpression(expr);
    }

    public get hasPlugins(): boolean
    {
        return this.plugins.length > 0;
    }

    public hasHook(hookName: PluginHookName): boolean
    {
        return (this.hookExecutionOrder.get(hookName)?.length ?? 0) > 0;
    }
}
