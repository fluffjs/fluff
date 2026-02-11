import type * as t from '@babel/types';
import type * as parse5 from 'parse5';

export interface FluffPlugin
{
    readonly name: string;
    dependencies?: Partial<Record<string, string[]>>;
    afterConfig?: (config: FluffConfig, pluginConfig: Record<string, unknown>) => void | Promise<void>;
    beforeClassTransform?: (context: ClassTransformContext) => void | Promise<void>;
    modifyEntryPoint?: (context: EntryPointContext) => void | Promise<void>;
    modifyIndexHtml?: (document: parse5.DefaultTreeAdapterMap['document']) => void | Promise<void>;
}

export interface FluffConfig
{
    version: string;
    targets: Record<string, FluffTarget>;
    defaultTarget?: string;
    plugins?: string[];
    pluginConfig?: Record<string, Record<string, unknown>>;
}

export interface FluffTarget
{
    name: string;
    srcDir: string;
    outDir: string;
    bundle?: BundleOptions;

    [key: string]: unknown;
}

export interface BundleOptions
{
    splitting?: boolean;

    [key: string]: unknown;
}

export interface ClassTransformContext
{
    ast: t.File;
    filePath: string;
    metadata: ComponentMetadata;
}

export interface ComponentMetadata
{
    selector: string;
    className: string;
    templateUrl?: string;
    template?: string;
    styleUrl?: string;
    styles?: string;
}

export interface EntryPointContext
{
    program: t.Program;
    srcDir: string;
}
