import type { ComponentMetadata } from './ComponentMetadata.js';
import type { DirectiveMetadata } from '../babel-plugin-directive.js';

export interface DiscoveryInfo
{
    components: ComponentDiscoveryEntry[];
    directives: DirectiveDiscoveryEntry[];
}

export interface ComponentDiscoveryEntry
{
    filePath: string;
    metadata: ComponentMetadata;
}

export interface DirectiveDiscoveryEntry
{
    filePath: string;
    metadata: DirectiveMetadata;
}
