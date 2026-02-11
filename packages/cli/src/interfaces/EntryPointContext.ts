import type * as t from '@babel/types';

export interface EntryPointContext
{
    program: t.Program;
    srcDir: string;
}
