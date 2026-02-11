import type { FluffTarget } from './FluffTarget.js';

export interface FluffConfig
{
    version: string;
    targets: Record<string, FluffTarget>;
    defaultTarget?: string;
    plugins?: string[];
    pluginConfig?: Record<string, Record<string, unknown>>;
}
