import type { PluginManager } from '../PluginManager.js';

export interface FluffPluginOptions
{
    srcDir: string;
    outDir?: string;
    minify?: boolean;
    sourcemap?: boolean;
    skipDefine?: boolean;
    production?: boolean;
    pluginManager?: PluginManager;
    globalStylesCss?: string;
}
