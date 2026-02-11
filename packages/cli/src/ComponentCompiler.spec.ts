import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ComponentCompiler } from './ComponentCompiler.js';
import type { CompileResult } from './interfaces/CompileResult.js';
import { PluginManager } from './PluginManager.js';
import type { FluffPlugin } from './interfaces/FluffPlugin.js';

vi.mock('esbuild', () =>
{
    return {
        transform: async(code: string): Promise<{ code: string }> =>
        {
            await Promise.resolve();
            return { code };
        },
        build: async(): Promise<{ metafile: { outputs: Record<string, unknown> } }> =>
        {
            await Promise.resolve();
            return { metafile: { outputs: {} } };
        }
    };
});

class TestCompiler extends ComponentCompiler
{
    public override async stripTypeScriptWithSourceMap(code: string): Promise<CompileResult>
    {
        await Promise.resolve();
        return { code };
    }

    public static createTempComponent(template: string, useInlineTemplate = true): { tempDir: string; componentPath: string }
    {
        const tempDir = mkdtempSync(path.join(tmpdir(), 'fluff-cc-'));
        const componentPath = path.join(tempDir, 'test.component.ts');

        if (useInlineTemplate)
        {
            const componentSource = `import { Component } from '@fluffjs/fluff';

@Component({
    selector: 'test-comp',
    template: \`${template}\`
})
export class TestComponent extends HTMLElement
{
}
`;
            writeFileSync(componentPath, componentSource);
        }
        else
        {
            const templatePath = path.join(tempDir, 'test.component.html');
            const componentSource = `import { Component } from '@fluffjs/fluff';

@Component({
    selector: 'test-comp',
    templateUrl: './test.component.html'
})
export class TestComponent extends HTMLElement
{
}
`;
            writeFileSync(componentPath, componentSource);
            writeFileSync(templatePath, template);
        }

        return { tempDir, componentPath };
    }

    public static createManagerWithUnrelatedPlugin(): PluginManager
    {
        const plugin: FluffPlugin = {
            name: 'unrelated-plugin',
            afterConfig: () => 
{}
        };
        const manager = new PluginManager();
        manager.registerPlugin(plugin);
        manager.resolveExecutionOrder();
        return manager;
    }
}

describe('ComponentCompiler', () =>
{
    it('should inject marker config when compiled component includes markers', async() =>
    {
        const { tempDir, componentPath } = TestCompiler.createTempComponent('@if (show) { <span>ok</span> }', false);
        try
        {
            const compiler = new TestCompiler();
            const result = await compiler.compileComponentForBundle(componentPath, false, false, true);

            expect(result.code)
                .toContain('__setMarkerConfigs(');
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

describe('ComponentCompiler plugin hook guards', () =>
{
    it('should not call beforeTemplatePreProcess when hook not bound', async() =>
    {
        const { tempDir, componentPath } = TestCompiler.createTempComponent(
            '<input type="text" /><div id="result">{{ value }}</div>'
        );
        try
        {
            const manager = TestCompiler.createManagerWithUnrelatedPlugin();
            const spy = vi.spyOn(manager, 'runBeforeTemplatePreProcess');

            const compiler = new TestCompiler();
            compiler.setPluginManager(manager);

            await compiler.compileComponentForBundle(componentPath, false, false, true);

            expect(spy, 'beforeTemplatePreProcess should not be called when no plugin binds to it')
                .not.toHaveBeenCalled();

            spy.mockRestore();
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should not call afterTemplateParse when hook not bound', async() =>
    {
        const { tempDir, componentPath } = TestCompiler.createTempComponent(
            '<div>{{ value }}</div>'
        );
        try
        {
            const manager = TestCompiler.createManagerWithUnrelatedPlugin();
            const spy = vi.spyOn(manager, 'runAfterTemplateParse');

            const compiler = new TestCompiler();
            compiler.setPluginManager(manager);

            await compiler.compileComponentForBundle(componentPath, false, false, true);

            expect(spy, 'afterTemplateParse should not be called when no plugin binds to it')
                .not.toHaveBeenCalled();

            spy.mockRestore();
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should not call afterCodeGeneration when hook not bound', async() =>
    {
        const { tempDir, componentPath } = TestCompiler.createTempComponent(
            '<div>{{ value }}</div>'
        );
        try
        {
            const manager = TestCompiler.createManagerWithUnrelatedPlugin();
            const spy = vi.spyOn(manager, 'runAfterCodeGeneration');

            const compiler = new TestCompiler();
            compiler.setPluginManager(manager);

            await compiler.compileComponentForBundle(componentPath, false, false, true);

            expect(spy, 'afterCodeGeneration should not be called when no plugin binds to it')
                .not.toHaveBeenCalled();

            spy.mockRestore();
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should not run beforeClassTransform babel round-trip when hook not bound', async() =>
    {
        const babelParser = await import('@babel/parser');
        const parseSpy = vi.spyOn(babelParser, 'parse');

        const { tempDir, componentPath } = TestCompiler.createTempComponent(
            '<div>{{ value }}</div>'
        );
        try
        {
            const compilerWithout = new TestCompiler();
            const callCountBefore1 = parseSpy.mock.calls.length;
            await compilerWithout.compileComponentForBundle(componentPath, false, false, true);
            const baselineCallCount = parseSpy.mock.calls.length - callCountBefore1;

            const compilerWith = new TestCompiler();
            compilerWith.setPluginManager(TestCompiler.createManagerWithUnrelatedPlugin());

            const callCountBefore2 = parseSpy.mock.calls.length;
            await compilerWith.compileComponentForBundle(componentPath, false, false, true);
            const withManagerCallCount = parseSpy.mock.calls.length - callCountBefore2;

            expect(withManagerCallCount, 'plugin not bound to beforeClassTransform should not add extra babel parse calls')
                .toBe(baselineCallCount);

            parseSpy.mockRestore();
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should treat void elements as implicitly self-closing after parse5 round-trip strips slash', async() =>
    {
        const plugin: FluffPlugin = {
            name: 'preprocess-plugin',
            beforeTemplatePreProcess: () => 
{}
        };
        const manager = new PluginManager();
        manager.registerPlugin(plugin);
        manager.resolveExecutionOrder();

        const { tempDir, componentPath } = TestCompiler.createTempComponent(
            '<input type="text" [value]="name" /><div id="result">{{ name }}</div>'
        );
        try
        {
            const compiler = new TestCompiler();
            compiler.setPluginManager(manager);

            const result = await compiler.compileComponentForBundle(componentPath, false, false, true);

            const innerHtmlMatch = /innerHTML\s*=\s*["'`](.+?)["'`]\s*;/.exec(result.code);
            expect(innerHtmlMatch, 'should produce an innerHTML assignment').toBeTruthy();

            const [, renderedHtml] = innerHtmlMatch ?? [];

            expect(renderedHtml, 'input should appear as a void element (no closing tag)')
                .toMatch(/<input[^>]*>/);
            expect(renderedHtml, 'input should not have a closing tag')
                .not.toContain('</input>');
            expect(renderedHtml, 'sibling div must not be consumed as child of input')
                .toMatch(/<div[^>]*>/);
            expect(renderedHtml, 'text marker must be present in sibling div')
                .toContain('fluff:text');
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
