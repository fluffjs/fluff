import { describe, expect, it, vi } from 'vitest';
import { IndexHtmlTransformer } from './IndexHtmlTransformer.js';
import { PluginManager } from './PluginManager.js';
import type { FluffPlugin } from './interfaces/FluffPlugin.js';

describe('IndexHtmlTransformer', () =>
{
    it('should inject live reload script into body when enabled', async() =>
    {
        const html = '<!DOCTYPE html><html><head></head><body><div>Test</div></body></html>';

        const result = await IndexHtmlTransformer.transform(html, {
            jsBundle: 'main.js',
            cssBundle: undefined,
            inlineStyles: undefined,
            gzip: false,
            minify: false,
            liveReload: true
        });

        expect(result)
            .toContain('<script>(function() {');
        expect(result)
            .toContain('</body>');
    });

    it('should not escape live reload script contents', async() =>
    {
        const html = '<!DOCTYPE html><html><head></head><body><div>Test</div></body></html>';

        const result = await IndexHtmlTransformer.transform(html, {
            jsBundle: 'main.js',
            cssBundle: undefined,
            inlineStyles: undefined,
            gzip: false,
            minify: false,
            liveReload: true
        });

        const startIndex = result.indexOf('<script>(function()');
        const endIndex = result.indexOf('</script>', startIndex);
        const scriptBody = startIndex >= 0 && endIndex > startIndex
            ? result.slice(startIndex, endIndex)
            : '';

        expect(scriptBody)
            .not
            .toContain('&amp;');
        expect(scriptBody)
            .not
            .toContain('&gt;');
    });

    it('should not inject live reload script when disabled', async() =>
    {
        const html = '<!DOCTYPE html><html><head></head><body><div>Test</div></body></html>';

        const result = await IndexHtmlTransformer.transform(html, {
            jsBundle: 'main.js',
            cssBundle: undefined,
            inlineStyles: undefined,
            gzip: false,
            minify: false,
            liveReload: false
        });

        expect(result)
            .not
            .toContain('<script>(function() {');
    });
});

describe('IndexHtmlTransformer plugin hook guards', () =>
{
    it('should not call modifyIndexHtml when hook not bound', async() =>
    {
        const html = '<!DOCTYPE html><html><head></head><body><div>Test</div></body></html>';

        const plugin: FluffPlugin = {
            name: 'unrelated-plugin',
            afterConfig: () => 
{}
        };
        const manager = new PluginManager();
        manager.registerPlugin(plugin);
        manager.resolveExecutionOrder();

        const spy = vi.spyOn(manager, 'runModifyIndexHtml');

        await IndexHtmlTransformer.transform(html, {
            jsBundle: 'main.js',
            cssBundle: undefined,
            inlineStyles: undefined,
            gzip: false,
            minify: false,
            pluginManager: manager
        });

        expect(spy, 'modifyIndexHtml should not be called when no plugin binds to it')
            .not.toHaveBeenCalled();

        spy.mockRestore();
    });
});
