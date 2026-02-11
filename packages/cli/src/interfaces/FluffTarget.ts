import type { BundleOptions } from './BundleOptions.js';
import type { ServeOptions } from './ServeOptions.js';

export interface FluffTarget
{
    name: string;
    srcDir: string;
    outDir: string;
    componentsDir?: string;
    tsConfigPath?: string;
    entryPoint?: string;
    exclude?: string[];
    indexHtml?: string;
    styles?: string[];
    globalStyles?: string[];
    assets?: string[];
    bundle?: BundleOptions;
    serve?: ServeOptions;
}
