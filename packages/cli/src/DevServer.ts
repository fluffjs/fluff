import httpProxy from 'http-proxy';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

export interface ProxyConfigEntry
{
    target: string;
    changeOrigin?: boolean;
}

export type ProxyConfig = Record<string, ProxyConfigEntry>;

export interface DevServerOptions
{
    port: number;
    host: string;
    outDir: string;
    proxyConfig?: ProxyConfig;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8'
};

export class DevServer
{
    private readonly options: DevServerOptions;
    private proxy: httpProxy | null = null;
    private server: http.Server | null = null;
    private wss: WebSocketServer | null = null;
    private readonly wsClients = new Set<WebSocket>();

    public constructor(options: DevServerOptions)
    {
        this.options = options;

        if (options.proxyConfig)
        {
            this.proxy = httpProxy.createProxyServer({});

            this.proxy.on('error', (err, req, res) =>
            {
                console.error('Proxy error:', err.message);
                if (res instanceof http.ServerResponse && !res.headersSent)
                {
                    res.writeHead(502, { 'Content-Type': 'text/plain' });
                    res.end('Proxy error: ' + err.message);
                }
            });
        }
    }

    public static loadProxyConfig(configPath: string): ProxyConfig | undefined
    {
        if (!fs.existsSync(configPath))
        {
            console.warn(`Proxy config not found: ${configPath}`);
            return undefined;
        }

        try
        {
            const content = fs.readFileSync(configPath, 'utf-8');
            const config: unknown = JSON.parse(content);
            if (typeof config === 'object' && config !== null && !Array.isArray(config))
            {
                const result: ProxyConfig = {};
                for (const [key, value] of Object.entries(config))
                {
                    if (DevServer.isProxyEntry(value))
                    {
                        result[key] = {
                            target: value.target,
                            changeOrigin: typeof value.changeOrigin === 'boolean' ? value.changeOrigin : undefined
                        };
                    }
                }
                return result;
            }
            return undefined;
        }
        catch(err)
        {
            console.error('Failed to parse proxy config:', err);
            return undefined;
        }
    }

    private static isProxyEntry(value: unknown): value is { target: string; changeOrigin?: boolean }
    {
        return typeof value === 'object' && value !== null && 'target' in value && typeof (value as {
            target: unknown
        }).target === 'string';
    }

    public async start(): Promise<number>
    {
        return new Promise((resolve, reject) =>
        {
            this.server = http.createServer((req, res) =>
            {
                this.handleRequest(req, res);
            });

            this.wss = new WebSocketServer({ noServer: true });

            this.server.on('upgrade', (req, socket, head) =>
            {
                if (req.url === '/_fluff/ws')
                {
                    this.wss?.handleUpgrade(req, socket, head, (ws) =>
                    {
                        this.wsClients.add(ws);
                        ws.on('close', () =>
                        {
                            this.wsClients.delete(ws);
                        });
                    });
                }
                else
                {
                    socket.destroy();
                }
            });

            this.server.on('error', (err) =>
            {
                reject(err);
            });

            this.server.listen(this.options.port, this.options.host, () =>
            {
                const address = this.server?.address();
                const port = typeof address === 'object' && address ? address.port : this.options.port;
                resolve(port);
            });
        });
    }

    public notifyReload(): void
    {
        const message = JSON.stringify({ type: 'reload' });
        for (const client of this.wsClients)
        {
            client.send(message);
        }
    }

    public stop(): void
    {
        if (this.wss)
        {
            this.wss.close();
            this.wss = null;
        }
        this.wsClients.clear();
        if (this.server)
        {
            this.server.close();
            this.server = null;
        }
        if (this.proxy)
        {
            this.proxy.close();
            this.proxy = null;
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void
    {
        const url = req.url ?? '/';
        const [pathname] = url.split('?');

        const proxyEntry = this.findProxyEntry(pathname);
        if (proxyEntry)
        {
            this.proxyRequest(req, res, proxyEntry);
        }
        else
        {
            this.serveStatic(res, pathname).catch((err: unknown) =>
            {
                console.error('Static serve error:', err);
                if (!res.headersSent)
                {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                }
            });
        }
    }

    private findProxyEntry(pathname: string): ProxyConfigEntry | undefined
    {
        if (!this.options.proxyConfig)
        {
            return undefined;
        }

        for (const [pattern, entry] of Object.entries(this.options.proxyConfig))
        {
            if (pathname === pattern || pathname.startsWith(pattern + '/') || pathname.startsWith(pattern + '?'))
            {
                return entry;
            }
        }

        return undefined;
    }

    private proxyRequest(req: http.IncomingMessage, res: http.ServerResponse, entry: ProxyConfigEntry): void
    {
        if (!this.proxy)
        {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Proxy not configured');
            return;
        }

        const options: httpProxy.ServerOptions = {
            target: entry.target, changeOrigin: entry.changeOrigin ?? false
        };

        this.proxy.web(req, res, options);
    }

    private async serveStatic(res: http.ServerResponse, pathname: string): Promise<void>
    {
        const hasExtension = /\.\w+$/.test(pathname);
        const resolvedPath = hasExtension ? path.resolve(this.options.outDir, pathname.replace(/^\/+/, '')) : path.resolve(this.options.outDir, 'index.html');
        const resolvedOutDir = path.resolve(this.options.outDir);

        if (!resolvedPath.startsWith(resolvedOutDir + path.sep))
        {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('403 - Forbidden');
            return;
        }

        if (!fs.existsSync(resolvedPath))
        {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 - Not Found');
            return;
        }

        const ext = path.extname(resolvedPath)
            .toLowerCase();
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

        const content = await fs.promises.readFile(resolvedPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    }
}
