import type { PluginManager } from '../PluginManager.js';

export interface HtmlTransformOptions
{
    jsBundle: string;
    cssBundle?: string;
    inlineStyles?: string;
    gzip?: boolean;
    gzScriptTag?: boolean;
    minify?: boolean;
    liveReload?: boolean;
    pluginManager?: PluginManager;
}
