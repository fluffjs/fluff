import he from 'he';
import { minify } from 'html-minifier-terser';
import * as parse5 from 'parse5';
import type { HtmlTransformOptions } from './interfaces/HtmlTransformOptions.js';
import { Parse5Helpers } from './Parse5Helpers.js';
import type { Parse5Node } from './Typeguards.js';
import { Typeguards } from './Typeguards.js';

export type { HtmlTransformOptions } from './interfaces/HtmlTransformOptions.js';

export class IndexHtmlTransformer
{
    private static readonly LIVE_RELOAD_SCRIPT = `(function() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + location.host + '/_fluff/ws';
    function connect() {
        var ws = new WebSocket(url);
        ws.onmessage = function(e) {
            var data = JSON.parse(e.data);
            if (data.type === 'reload') {
                location.reload();
            }
        };
        ws.onclose = function() {
            setTimeout(connect, 1000);
        };
    }
    connect();
})();`;

    public static async transform(html: string, options: HtmlTransformOptions): Promise<string>
    {
        const doc = parse5.parse(html);

        const jsSrc = options.gzScriptTag ? `${options.jsBundle}.gz` : options.jsBundle;
        const cssSrc = options.cssBundle ? (options.gzScriptTag ? `${options.cssBundle}.gz` : options.cssBundle) : null;

        const head = Parse5Helpers.findElement(doc, 'head');
        const body = Parse5Helpers.findElement(doc, 'body');

        if (head && options.inlineStyles)
        {
            const styleEl = Parse5Helpers.createElement('style', []);
            Parse5Helpers.appendText(styleEl, options.inlineStyles);
            Parse5Helpers.appendChild(head, styleEl);
        }

        if (head && cssSrc)
        {
            const linkEl = Parse5Helpers.createElement('link', [
                { name: 'rel', value: 'stylesheet' }, { name: 'href', value: cssSrc }
            ]);
            Parse5Helpers.appendChild(head, linkEl);
        }

        if (body)
        {
            const scriptEl = Parse5Helpers.createElement('script', [
                { name: 'type', value: 'module' }, { name: 'src', value: jsSrc }
            ]);
            Parse5Helpers.appendChild(body, scriptEl);
        }

        if (body && options.liveReload)
        {
            const inlineScriptEl = Parse5Helpers.createElement('script', []);
            Parse5Helpers.appendText(inlineScriptEl, IndexHtmlTransformer.LIVE_RELOAD_SCRIPT);
            Parse5Helpers.appendChild(body, inlineScriptEl);
        }

        if (options.liveReload)
        {
            IndexHtmlTransformer.decodeScriptTextNodes(doc);
        }

        if (options.pluginManager?.hasHook('modifyIndexHtml'))
        {
            await options.pluginManager.runModifyIndexHtml(doc);
        }

        let result = parse5.serialize(doc);

        if (options.minify)
        {
            result = await minify(result, {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeEmptyAttributes: true,
                minifyCSS: true,
                minifyJS: true
            });
        }

        return result;
    }

    private static decodeScriptTextNodes(node: Parse5Node): void
    {
        Parse5Helpers.walkNodes(node, (n) =>
        {
            if (Typeguards.isElement(n) && n.tagName === 'script')
            {
                for (const child of n.childNodes)
                {
                    if ('value' in child && typeof child.value === 'string')
                    {
                        child.value = he.decode(child.value);
                    }
                }
            }
            return undefined;
        });
    }

}
