import type * as t from '@babel/types';

export interface PluginCustomTable
{
    name: string;
    elements: t.Expression[];
}
