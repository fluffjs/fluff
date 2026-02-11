import type * as t from '@babel/types';
import type { ComponentMetadata } from './ComponentMetadata.js';

export interface ClassTransformContext
{
    ast: t.File;
    filePath: string;
    metadata: ComponentMetadata;
}
