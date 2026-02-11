import * as t from '@babel/types';
import { execSync } from 'child_process';
import { randomBytes, randomUUID } from 'crypto';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import picomatch from 'picomatch';
import { gzipSync } from 'zlib';
import { generate } from './BabelHelpers.js';
import { ComponentCompiler } from './ComponentCompiler.js';
import { DevServer } from './DevServer.js';
import { fluffPlugin } from './fluff-esbuild-plugin.js';
import { Generator } from './Generator.js';
import { IndexHtmlTransformer } from './IndexHtmlTransformer.js';
import type { CliOptions } from './interfaces/CliOptions.js';
import { PluginLoader } from './PluginLoader.js';
import type { PluginManager } from './PluginManager.js';
import type { FluffConfig, FluffTarget } from './types/FluffConfig.js';
import { DEFAULT_CONFIG } from './types/FluffConfig.js';

interface EntryPointConfig
{
    useStdin: boolean;
    entryPointFile: string | null;
    generatedEntry: { contents: string; resolveDir: string } | null;
    tempEntryFile: string | null;
}

interface EsbuildEntryConfig
{
    stdin?: { contents: string; resolveDir: string; loader: 'ts' };
    entryPoints?: string[];
}

interface BaseEsbuildParams
{
    entry: EntryPointConfig;
    appDir: string;
    outDir: string;
    splitting: boolean;
    minify: boolean;
    tsconfigRaw: string;
    pluginManager: PluginManager;
    production: boolean;
    sourcemap?: boolean;
    target?: string;
    metafile?: boolean;
    external?: string[];
    extraPlugins?: esbuild.Plugin[];
    globalStylesCss?: string;
}

export class Cli
{
    private readonly cwd: string;
    private readonly nxPackage: string | undefined;
    private readonly noGzip: boolean;
    private readonly noMinify: boolean;
    private readonly gzScriptTag: boolean;

    public constructor(options: CliOptions = {})
    {
        this.cwd = options.cwd ?? this.resolveCwd();
        this.nxPackage = options.nxPackage;
        this.noGzip = options.noGzip ?? false;
        this.noMinify = options.noMinify ?? false;
        this.gzScriptTag = options.gzScriptTag ?? false;
    }

    public static parseArgs(argv: string[]): { options: CliOptions; args: string[] }
    {
        const options: CliOptions = {};
        const args: string[] = [];

        let i = 0;
        while (i < argv.length)
        {
            const arg = argv[i];

            if (arg === '--nx' && argv[i + 1])
            {
                options.nxPackage = argv[i + 1];
                i += 2;
            }
            else if (arg === '--cwd' && argv[i + 1])
            {
                options.cwd = argv[i + 1];
                i += 2;
            }
            else if (arg === '--no-gzip')
            {
                options.noGzip = true;
                i++;
            }
            else if (arg === '--no-minify')
            {
                options.noMinify = true;
                i++;
            }
            else if (arg === '--gz-script-tag')
            {
                options.gzScriptTag = true;
                i++;
            }
            else if (arg?.startsWith('--'))
            {
                console.error(`Unknown option: ${arg}`);
                process.exit(1);
            }
            else if (arg)
            {
                args.push(arg);
                i++;
            }
            else
            {
                i++;
            }
        }

        return { options, args };
    }

    public async run(args: string[]): Promise<void>
    {
        const [command, ...commandArgs] = args;

        switch (command)
        {
            case 'init':
                this.init(commandArgs);
                break;
            case 'build':
                await this.build(commandArgs);
                break;
            case 'generate':
            case 'new':
                this.generate(commandArgs);
                break;
            case 'serve':
                await this.serve(commandArgs);
                break;
            case 'help':
            case '--help':
            case '-h':
            case undefined:
                this.showHelp();
                break;
            default:
                console.error(`Unknown command: ${command}`);
                this.showHelp();
                process.exit(1);
        }
    }

    private resolveCwd(): string
    {
        const processCwd = process.cwd();
        if (fs.existsSync(path.join(processCwd, 'fluff.json')))
        {
            return processCwd;
        }
        return process.env.INIT_CWD ?? processCwd;
    }

    private showHelp(): void
    {
        console.log(`
Fluff CLI - Build tool for Fluff components

Usage: fluff <command> [options]

Commands:
  init [target]           Initialize a new fluff.json configuration
  generate <app-name>     Generate a new Fluff app (alias: new)
  build [target]          Build the project (or specific target)
  serve [target]          Start dev server with watch mode
  help                    Show this help message

Options:
  --nx <package>          Use nx workspace, specify package name
  --cwd <dir>             Set working directory
  --no-gzip               Disable gzip compression (overrides config)

Generate Options:
  --packageManager, -p    Package manager to use (npm, yarn, pnpm, bun)

Examples:
  fluff init              Create fluff.json with default configuration
  fluff generate my-app   Create a new Fluff app called 'my-app'
  fluff generate my-app --packageManager pnpm   Create app and install with pnpm
  fluff build             Build the default target
  fluff build app         Build the 'app' target
  fluff --nx @myorg/app build   Build an nx package
`);
    }

    private getProjectRoot(): string
    {
        if (this.nxPackage)
        {
            return this.findNxPackageRoot(this.nxPackage);
        }
        return this.cwd;
    }

    private findNxPackageRoot(packageName: string): string
    {
        const nxJsonPath = this.findNxJson(this.cwd);
        if (!nxJsonPath)
        {
            throw new Error('Not in an nx workspace (nx.json not found)');
        }

        const workspaceRoot = path.dirname(nxJsonPath);
        const packagesDir = path.join(workspaceRoot, 'packages');
        const appsDir = path.join(workspaceRoot, 'apps');
        const libsDir = path.join(workspaceRoot, 'libs');

        for (const searchDir of [packagesDir, appsDir, libsDir])
        {
            if (!fs.existsSync(searchDir)) continue;

            const entries = fs.readdirSync(searchDir, { withFileTypes: true });
            for (const entry of entries)
            {
                if (!entry.isDirectory()) continue;

                const pkgJsonPath = path.join(searchDir, entry.name, 'package.json');
                if (fs.existsSync(pkgJsonPath))
                {
                    const pkgJsonContent: unknown = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                    if (typeof pkgJsonContent !== 'object' || pkgJsonContent === null) continue;
                    if ('name' in pkgJsonContent && pkgJsonContent.name === packageName)
                    {
                        return path.join(searchDir, entry.name);
                    }
                }
            }
        }

        throw new Error(`nx package '${packageName}' not found in workspace`);
    }

    private findNxJson(startDir: string): string | null
    {
        let dir = startDir;
        while (dir !== path.dirname(dir))
        {
            const nxJsonPath = path.join(dir, 'nx.json');
            if (fs.existsSync(nxJsonPath))
            {
                return nxJsonPath;
            }
            dir = path.dirname(dir);
        }
        return null;
    }

    private getConfigPath(): string
    {
        return path.join(this.getProjectRoot(), 'fluff.json');
    }

    private isFluffConfig(value: unknown): value is FluffConfig
    {
        if (typeof value !== 'object' || value === null) return false;
        if (!('version' in value) || typeof value.version !== 'string') return false;
        return !(!('targets' in value) || typeof value.targets !== 'object' || value.targets === null);

    }

    private loadConfig(): FluffConfig
    {
        return this.loadConfigFrom(this.getConfigPath());
    }

    private loadConfigFrom(configPath: string): FluffConfig
    {
        if (!fs.existsSync(configPath))
        {
            throw new Error(`fluff.json not found at ${configPath}. Run 'fluff init' first.`);
        }

        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        if (!this.isFluffConfig(parsed))
        {
            throw new Error('Invalid fluff.json: missing required fields');
        }
        return parsed;
    }

    private tryResolveNxProject(nameOrDir: string, workspaceRoot: string): string | null
    {
        const projectJsonPaths = this.findProjectJsonFiles(workspaceRoot);

        for (const projectJsonPath of projectJsonPaths)
        {
            const projectDir = path.dirname(projectJsonPath);
            const projectJsonContent: unknown = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));

            if (typeof projectJsonContent === 'object' && projectJsonContent !== null && 'name' in projectJsonContent)
            {
                const projectName = projectJsonContent.name;
                if (projectName === nameOrDir && fs.existsSync(path.join(projectDir, 'fluff.json')))
                {
                    return projectDir;
                }
            }
        }

        const packagesDir = path.join(workspaceRoot, 'packages');
        const appsDir = path.join(workspaceRoot, 'apps');
        const libsDir = path.join(workspaceRoot, 'libs');

        for (const searchDir of [packagesDir, appsDir, libsDir])
        {
            if (!fs.existsSync(searchDir)) continue;

            const directPath = path.join(searchDir, nameOrDir);
            if (fs.existsSync(path.join(directPath, 'fluff.json')))
            {
                return directPath;
            }

            const entries = fs.readdirSync(searchDir, { withFileTypes: true });
            for (const entry of entries)
            {
                if (!entry.isDirectory()) continue;

                const projectPath = path.join(searchDir, entry.name);
                const pkgJsonPath = path.join(projectPath, 'package.json');

                if (fs.existsSync(pkgJsonPath))
                {
                    const pkgJsonContent: unknown = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                    if (typeof pkgJsonContent === 'object' && pkgJsonContent !== null && 'name' in pkgJsonContent)
                    {
                        const pkgName = pkgJsonContent.name;
                        if (pkgName === nameOrDir || pkgName === `@fluffjs/${nameOrDir}`)
                        {
                            if (fs.existsSync(path.join(projectPath, 'fluff.json')))
                            {
                                return projectPath;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    private findProjectJsonFiles(dir: string, depth = 0): string[]
    {
        if (depth > 3) return [];

        const results: string[] = [];
        const projectJsonPath = path.join(dir, 'project.json');

        if (fs.existsSync(projectJsonPath))
        {
            results.push(projectJsonPath);
        }

        if (depth < 3)
        {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries)
            {
                if (!entry.isDirectory()) continue;
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;

                results.push(...this.findProjectJsonFiles(path.join(dir, entry.name), depth + 1));
            }
        }

        return results;
    }

    private init(args: string[]): void
    {
        const [targetName] = args;
        const configPath = this.getConfigPath();

        let config: FluffConfig = { ...DEFAULT_CONFIG };

        if (fs.existsSync(configPath))
        {
            if (targetName)
            {
                config = this.loadConfig();
                if (config.targets[targetName])
                {
                    console.error(`Target '${targetName}' already exists in fluff.json`);
                    process.exit(1);
                }
                config.targets[targetName] = {
                    name: targetName,
                    srcDir: `src/${targetName}`,
                    outDir: `dist/${targetName}`,
                    assets: ['**/*.html', '**/*.css']
                };
                console.log(`Added target '${targetName}' to fluff.json`);
            }
            else
            {
                console.error('fluff.json already exists. Use "fluff init <target>" to add a new target.');
                process.exit(1);
            }
        }
        else
        {
            config = { ...DEFAULT_CONFIG };
            if (targetName)
            {
                config.targets = {
                    [targetName]: {
                        name: targetName, srcDir: 'src', outDir: 'dist', assets: ['**/*.html', '**/*.css']
                    }
                };
                config.defaultTarget = targetName;
            }
            console.log('Created fluff.json');
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Configuration saved to ${configPath}`);
    }

    private generate(args: string[]): void
    {
        let appName: string | undefined = undefined;
        let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | undefined = undefined;

        for (let i = 0; i < args.length; i++)
        {
            const arg = args[i];
            if (arg === '--packageManager' || arg === '-p')
            {
                const nextArg = args[i + 1];
                if (nextArg === 'npm' || nextArg === 'yarn' || nextArg === 'pnpm' || nextArg === 'bun')
                {
                    packageManager = nextArg;
                    i++;
                }
            }
            else if (!arg.startsWith('-'))
            {
                appName = arg;
            }
        }

        if (!appName)
        {
            console.error('Usage: fluff generate <app-name> [--packageManager npm|yarn|pnpm|bun]');
            console.error('Example: fluff generate my-app --packageManager npm');
            process.exit(1);
        }

        const generator = new Generator();
        generator.generate({
            appName, outputDir: this.cwd, packageManager
        });
    }

    private async build(args: string[]): Promise<void>
    {
        let targetOrProject: string | undefined = args[0];
        let projectRoot = this.getProjectRoot();
        let workspaceRoot: string | null = null;
        let projectRelativePath: string | null = null;

        const nxJsonPath = this.findNxJson(this.cwd);
        if (nxJsonPath && targetOrProject)
        {
            workspaceRoot = path.dirname(nxJsonPath);
            const resolvedProject = this.tryResolveNxProject(targetOrProject, workspaceRoot);
            if (resolvedProject)
            {
                projectRoot = resolvedProject;
                projectRelativePath = path.relative(workspaceRoot, resolvedProject);
                targetOrProject = undefined;
            }
        }

        const configPath = path.join(projectRoot, 'fluff.json');
        if (!fs.existsSync(configPath))
        {
            throw new Error(`fluff.json not found at ${configPath}. Run 'fluff init' first.`);
        }

        const config = this.loadConfigFrom(configPath);
        const pluginManager = await this.loadPlugins(config, projectRoot);

        let targets: FluffTarget[] = [];

        if (targetOrProject)
        {
            const target = config.targets[targetOrProject];
            if (!target)
            {
                console.error(`Target '${targetOrProject}' not found in fluff.json`);
                console.error(`Available targets: ${Object.keys(config.targets)
                    .join(', ')}`);
                process.exit(1);
            }
            targets = [target];
        }
        else if (config.defaultTarget)
        {
            const target = config.targets[config.defaultTarget];
            if (!target)
            {
                console.error(`Default target '${config.defaultTarget}' not found in fluff.json`);
                process.exit(1);
            }
            targets = [target];
        }
        else
        {
            targets = Object.values(config.targets);
        }

        for (const target of targets)
        {
            await this.buildTarget(target, projectRoot, workspaceRoot, projectRelativePath, pluginManager);
        }
    }

    private async buildTarget(target: FluffTarget, projectRoot: string, workspaceRoot: string | null, projectRelativePath: string | null, pluginManager: PluginManager): Promise<void>
    {
        console.log(`🔨 Building target '${target.name}'...`);

        const srcDir = path.resolve(projectRoot, target.srcDir);
        const appDir = path.join(srcDir, target.componentsDir ?? 'app');

        const outDir = (workspaceRoot && projectRelativePath) ? path.join(workspaceRoot, 'dist', projectRelativePath) : path.resolve(projectRoot, target.outDir);

        if (!fs.existsSync(srcDir))
        {
            throw new Error(`Source directory not found: ${srcDir}`);
        }

        if (!fs.existsSync(outDir))
        {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const bundleOptions = { ...target.bundle };
        if (this.noGzip)
        {
            bundleOptions.gzip = false;
        }
        if (this.noMinify)
        {
            bundleOptions.minify = false;
        }
        const splitting = bundleOptions.splitting ?? false;
        const entry = this.resolveEntryPoint(target, srcDir, splitting);
        const inlineStyles = await this.collectStyles(target, srcDir, bundleOptions.minify ?? true);
        const globalStylesCss = await this.collectGlobalStyles(target, srcDir, bundleOptions.minify ?? true);

        this.runTypeCheck(target, projectRoot);

        console.log('   Building with esbuild...');

        const tsconfigRaw = this.loadTsConfig(target, projectRoot);

        const result = await esbuild.build(this.buildBaseEsbuildConfig({
            entry, appDir, outDir, splitting,
            minify: bundleOptions.minify ?? true,
            tsconfigRaw, pluginManager,
            production: true,
            target: bundleOptions.target ?? 'es2022',
            metafile: true,
            external: bundleOptions.external ?? [],
            globalStylesCss
        }))
            .finally(() =>
            {
                this.cleanupTempEntry(entry);
            });

        const outputKeys = Object.keys(result.metafile?.outputs ?? {});
        const jsBundleName = this.getJsBundleName(entry);
        const jsBundle = outputKeys.find(f => path.basename(f) === jsBundleName);
        const cssBundle = outputKeys.find(f => f.endsWith('.css'));

        if (jsBundle)
        {
            const jsPath = path.join(outDir, jsBundleName);

            if (bundleOptions.gzip)
            {
                const gzipContent = fs.readFileSync(jsPath);
                const gzipped = gzipSync(gzipContent, { level: 9 });
                fs.writeFileSync(`${jsPath}.gz`, gzipped);
                fs.unlinkSync(jsPath);
                console.log(`   ✓ Created ${jsBundleName}.gz (${gzipped.length} bytes)`);
            }
            else
            {
                console.log(`   ✓ Created ${jsBundleName}`);
            }
        }

        if (cssBundle)
        {
            const cssBundleName = path.basename(cssBundle);
            const cssPath = path.join(outDir, cssBundleName);

            if (bundleOptions.gzip)
            {
                const cssContent = fs.readFileSync(cssPath);
                const gzipped = gzipSync(cssContent, { level: 9 });
                fs.writeFileSync(`${cssPath}.gz`, gzipped);
                fs.unlinkSync(cssPath);
                console.log(`   ✓ Created ${cssBundleName}.gz (${gzipped.length} bytes)`);
            }
            else
            {
                console.log(`   ✓ Created ${cssBundleName}`);
            }
        }

        if (target.indexHtml)
        {
            const indexHtmlPath = path.join(srcDir, target.indexHtml);
            if (fs.existsSync(indexHtmlPath))
            {
                const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
                const transformed = await IndexHtmlTransformer.transform(indexHtml, {
                    jsBundle: jsBundle ? path.basename(jsBundle) : 'main.js',
                    cssBundle: cssBundle ? path.basename(cssBundle) : undefined,
                    inlineStyles: inlineStyles || undefined,
                    gzip: bundleOptions.gzip,
                    gzScriptTag: bundleOptions.gzScriptTag ?? this.gzScriptTag,
                    minify: bundleOptions.minify,
                    pluginManager
                });
                fs.writeFileSync(path.join(outDir, 'index.html'), transformed);
                console.log('   ✓ Transformed index.html');
            }
        }

        if (target.assets)
        {
            await this.copyAssets(target.assets, projectRoot, srcDir, outDir, target.indexHtml);
        }

        console.log(`✅ Target '${target.name}' built successfully!`);
    }

    private async serve(args: string[]): Promise<void>
    {
        let targetOrProject: string | undefined = args[0];
        let projectRoot = this.getProjectRoot();
        let workspaceRoot: string | null = null;
        let projectRelativePath: string | null = null;

        const nxJsonPath = this.findNxJson(this.cwd);
        if (nxJsonPath && targetOrProject)
        {
            workspaceRoot = path.dirname(nxJsonPath);
            const resolvedProject = this.tryResolveNxProject(targetOrProject, workspaceRoot);
            if (resolvedProject)
            {
                projectRoot = resolvedProject;
                projectRelativePath = path.relative(workspaceRoot, resolvedProject);
                targetOrProject = undefined;
            }
        }

        const configPath = path.join(projectRoot, 'fluff.json');
        if (!fs.existsSync(configPath))
        {
            throw new Error(`fluff.json not found at ${configPath}. Run 'fluff init' first.`);
        }

        const config = this.loadConfigFrom(configPath);
        const pluginManager = await this.loadPlugins(config, projectRoot);

        let target: FluffTarget | undefined = undefined;

        if (targetOrProject)
        {
            target = config.targets[targetOrProject];
            if (!target)
            {
                console.error(`Target '${targetOrProject}' not found in fluff.json`);
                process.exit(1);
            }
        }
        else if (config.defaultTarget)
        {
            target = config.targets[config.defaultTarget];
            if (!target)
            {
                console.error(`Default target '${config.defaultTarget}' not found in fluff.json`);
                process.exit(1);
            }
        }
        else
        {
            [target] = Object.values(config.targets);
            if (!target)
            {
                console.error('No targets found in fluff.json');
                process.exit(1);
            }
        }

        await this.serveTarget(target, projectRoot, workspaceRoot, projectRelativePath, pluginManager);
    }

    private async serveTarget(target: FluffTarget, projectRoot: string, workspaceRoot: string | null, projectRelativePath: string | null, pluginManager: PluginManager): Promise<void>
    {
        const srcDir = path.resolve(projectRoot, target.srcDir);
        const appDir = path.join(srcDir, target.componentsDir ?? 'app');

        const fluffDir = path.join(this.cwd, '.fluff');
        const serveId = randomUUID();
        const outDir = path.join(fluffDir, serveId);

        if (!fs.existsSync(outDir))
        {
            fs.mkdirSync(outDir, { recursive: true });
        }

        let entry: EntryPointConfig | null = null;
        let ctx: esbuild.BuildContext | null = null;
        const cleanup = (): void =>
        {
            try
            {
                if (ctx)
                {
                    ctx.dispose().catch((e: unknown) =>
                    {
                        console.error('Failed to dispose esbuild context:', e);
                    });
                    ctx = null;
                }
                this.cleanupTempEntry(entry);
                if (fs.existsSync(outDir))
                {
                    fs.rmSync(outDir, { recursive: true, force: true });
                }
            }
            catch
            {
            }
        };

        process.on('exit', cleanup);
        process.on('SIGINT', () =>
        {
            cleanup();
            process.exit(0);
        });
        process.on('SIGTERM', () =>
        {
            cleanup();
            process.exit(0);
        });

        const serveOptions = target.serve ?? {};
        const port = serveOptions.port ?? 3000;
        const host = serveOptions.host ?? 'localhost';

        let proxyConfig = undefined;
        if (serveOptions.proxyConfig)
        {
            const proxyConfigPath = path.resolve(projectRoot, serveOptions.proxyConfig);
            proxyConfig = DevServer.loadProxyConfig(proxyConfigPath);
            if (proxyConfig)
            {
                console.log(`   ✓ Proxy config: ${serveOptions.proxyConfig}`);
                for (const route of Object.keys(proxyConfig))
                {
                    console.log(`      ${route} -> ${proxyConfig[route].target}`);
                }
            }
        }

        const bundleOptions = { ...target.bundle };
        const splitting = bundleOptions.splitting ?? false;
        entry = this.resolveEntryPoint(target, srcDir, splitting);
        const inlineStyles = await this.collectStyles(target, srcDir, false);
        const globalStylesCss = await this.collectGlobalStyles(target, srcDir, false);

        if (target.indexHtml)
        {
            const indexHtmlPath = path.join(srcDir, target.indexHtml);
            if (fs.existsSync(indexHtmlPath))
            {
                const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
                const transformed = await IndexHtmlTransformer.transform(indexHtml, {
                    jsBundle: this.getJsBundleName(entry),
                    cssBundle: undefined,
                    inlineStyles: inlineStyles || undefined,
                    gzip: false,
                    minify: false,
                    liveReload: true,
                    pluginManager
                });
                fs.writeFileSync(path.join(outDir, 'index.html'), transformed);
            }
        }

        if (target.assets)
        {
            this.copyAssetsForServe(target.assets, projectRoot, srcDir, outDir, target.indexHtml);
        }

        console.log(`🚀 Starting dev server for '${target.name}'...`);

        const tsconfigRaw = this.loadTsConfig(target, projectRoot);

        const devServer = new DevServer({
            port, host, outDir, proxyConfig
        });

        ctx = await esbuild.context(this.buildBaseEsbuildConfig({
            entry, appDir, outDir, splitting,
            minify: false,
            tsconfigRaw, pluginManager,
            production: false,
            sourcemap: true,
            globalStylesCss,
            extraPlugins: [{
                name: 'fluff-live-reload', setup(build): void
                {
                    build.onEnd((result) =>
                    {
                        if (result.errors.length === 0)
                        {
                            console.log('[watch] build finished, watching for changes...');
                            devServer.notifyReload();
                        }
                    });
                }
            }]
        }));

        await ctx.watch();
        console.log('   Watching for changes...');

        await devServer.start();
        console.log(`   Server running at http://${host}:${port}`);
        console.log('   Press Ctrl+C to stop\n');
    }

    private resolveEntryPoint(target: FluffTarget, srcDir: string, splitting: boolean): EntryPointConfig
    {
        if (!target.entryPoint)
        {
            const generated = this.generateEntryContent(srcDir, target.exclude);

            if (splitting)
            {
                let tempPath = path.join(srcDir, 'fluff-app.ts');
                if (fs.existsSync(tempPath))
                {
                    const hex = randomBytes(4).toString('hex');
                    tempPath = path.join(srcDir, `fluff-app-${hex}.ts`);
                }
                fs.writeFileSync(tempPath, generated.contents);
                return { useStdin: false, entryPointFile: tempPath, generatedEntry: null, tempEntryFile: tempPath };
            }

            return { useStdin: true, entryPointFile: null, generatedEntry: generated, tempEntryFile: null };
        }

        return {
            useStdin: false,
            entryPointFile: path.join(srcDir, target.entryPoint),
            generatedEntry: null,
            tempEntryFile: null
        };
    }

    private async loadPlugins(config: FluffConfig, projectRoot: string): Promise<PluginManager>
    {
        const pluginManager = await PluginLoader.load(config, projectRoot);
        if (pluginManager.hasPlugins)
        {
            await pluginManager.runAfterConfig(config, config.pluginConfig ?? {});
        }
        return pluginManager;
    }

    private cleanupTempEntry(entry: EntryPointConfig | null): void
    {
        if (entry?.tempEntryFile && fs.existsSync(entry.tempEntryFile))
        {
            fs.unlinkSync(entry.tempEntryFile);
        }
    }

    private buildBaseEsbuildConfig(params: BaseEsbuildParams): esbuild.BuildOptions
    {
        return {
            ...this.getEsbuildEntryConfig(params.entry),
            bundle: true,
            ...(params.entry.useStdin
                ? { outfile: path.join(params.outDir, 'fluff-app.js') }
                : { outdir: params.outDir, entryNames: '[name]' }),
            format: 'esm',
            platform: 'browser',
            target: params.target ?? 'es2022',
            minify: params.minify,
            splitting: params.splitting,
            treeShaking: true,
            metafile: params.metafile ?? false,
            sourcemap: params.sourcemap ?? false,
            plugins: [
                fluffPlugin({
                    srcDir: params.appDir,
                    outDir: params.outDir,
                    minify: params.minify,
                    sourcemap: params.sourcemap,
                    skipDefine: false,
                    production: params.production,
                    pluginManager: params.pluginManager,
                    globalStylesCss: params.globalStylesCss
                }),
                ...(params.extraPlugins ?? [])
            ],
            external: params.external ?? [],
            logLevel: 'warning',
            tsconfigRaw: params.tsconfigRaw
        };
    }

    private getEsbuildEntryConfig(entry: EntryPointConfig): EsbuildEntryConfig
    {
        if (entry.useStdin && entry.generatedEntry)
        {
            return {
                stdin: {
                    contents: entry.generatedEntry.contents, resolveDir: entry.generatedEntry.resolveDir, loader: 'ts'
                }
            };
        }
        return { entryPoints: [entry.entryPointFile ?? ''] };
    }

    private getJsBundleName(entry: EntryPointConfig): string
    {
        if (entry.useStdin)
        {
            return 'fluff-app.js';
        }
        return path.basename(entry.entryPointFile ?? '')
            .replace(/\.ts$/, '.js');
    }

    private async collectStyles(target: FluffTarget, srcDir: string, minify: boolean): Promise<string>
    {
        if (!target.styles || target.styles.length === 0)
        {
            return '';
        }

        const styleContents: string[] = [];
        for (const stylePath of target.styles)
        {
            const fullPath = path.resolve(srcDir, stylePath);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath)
                .isFile())
            {
                console.log(`   ✓ Style: ${stylePath}`);
                styleContents.push(fs.readFileSync(fullPath, 'utf-8'));
            }
            else
            {
                const styleFiles = this.findFiles(srcDir, [stylePath]);
                if (styleFiles.length === 0)
                {
                    console.warn(`   ⚠ Style not found: ${fullPath}`);
                }
                for (const styleFile of styleFiles)
                {
                    console.log(`   ✓ Style: ${path.relative(srcDir, styleFile)}`);
                    styleContents.push(fs.readFileSync(styleFile, 'utf-8'));
                }
            }
        }

        if (styleContents.length === 0)
        {
            return '';
        }

        let inlineStyles = styleContents.join('\n');
        if (minify)
        {
            const cssResult = await esbuild.transform(inlineStyles, {
                loader: 'css', minify: true
            });
            inlineStyles = cssResult.code;
        }
        console.log('   ✓ Bundled global styles');
        return inlineStyles;
    }

    private async collectGlobalStyles(target: FluffTarget, srcDir: string, minify: boolean): Promise<string>
    {
        if (!target.globalStyles || target.globalStyles.length === 0)
        {
            return '';
        }

        const styleContents: string[] = [];
        for (const stylePath of target.globalStyles)
        {
            const fullPath = path.resolve(srcDir, stylePath);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath)
                .isFile())
            {
                console.log(`   ✓ Global style: ${stylePath}`);
                styleContents.push(fs.readFileSync(fullPath, 'utf-8'));
            }
            else
            {
                const styleFiles = this.findFiles(srcDir, [stylePath]);
                if (styleFiles.length === 0)
                {
                    console.warn(`   ⚠ Global style not found: ${fullPath}`);
                }
                for (const styleFile of styleFiles)
                {
                    console.log(`   ✓ Global style: ${path.relative(srcDir, styleFile)}`);
                    styleContents.push(fs.readFileSync(styleFile, 'utf-8'));
                }
            }
        }

        if (styleContents.length === 0)
        {
            return '';
        }

        let css = styleContents.join('\n');
        if (minify)
        {
            const cssResult = await esbuild.transform(css, {
                loader: 'css', minify: true
            });
            css = cssResult.code;
        }
        console.log('   ✓ Bundled global component styles');
        return css;
    }

    private loadTsConfig(target: FluffTarget, projectRoot: string): string
    {
        return target.tsConfigPath ? fs.readFileSync(path.resolve(projectRoot, target.tsConfigPath), 'utf-8') : '{}';
    }

    private runTypeCheck(target: FluffTarget, projectRoot: string): void
    {
        if (!target.tsConfigPath)
        {
            return;
        }

        const tsconfigPath = path.resolve(projectRoot, target.tsConfigPath);
        if (!fs.existsSync(tsconfigPath))
        {
            console.warn(`   ⚠ tsconfig not found: ${tsconfigPath}, skipping type check`);
            return;
        }

        console.log('   Checking types...');
        try
        {
            execSync(`npx -p typescript tsc --noEmit -p ${target.tsConfigPath}`, {
                cwd: projectRoot, stdio: 'inherit'
            });
            console.log('   ✓ Type check passed');
        }
        catch
        {
            console.error('   ✗ Type check failed');
            process.exit(1);
        }
    }

    private generateEntryContent(srcDir: string, exclude: string[] = []): { contents: string; resolveDir: string }
    {
        const tsFiles = this.findAllTsFiles(srcDir, exclude);
        for (const f of tsFiles)
        {
            console.log(`   ✓ ${path.relative(srcDir, f)}`);
        }
        const importDecls = tsFiles.map(f =>
        {
            const relativePath = './' + path.relative(srcDir, f)
                .replace(/\\/g, '/');
            return t.importDeclaration([], t.stringLiteral(relativePath));
        });

        importDecls.unshift(t.importDeclaration([], t.stringLiteral('@fluff/expr-table')));

        const program = t.program(importDecls);
        const entryContent = generate(program, { compact: false }).code;
        return { contents: entryContent, resolveDir: srcDir };
    }

    private findAllTsFiles(dir: string, userExclude: string[] = []): string[]
    {
        const files: string[] = [];
        const excludePatterns = ['*.spec.ts', '*.test.ts', 'fluff-app*.ts', ...userExclude];

        const walk = (currentDir: string): void =>
        {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries)
            {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory())
                {
                    walk(fullPath);
                }
                else if (entry.isFile() && entry.name.endsWith('.ts'))
                {
                    const relativePath = path.relative(dir, fullPath)
                        .replace(/\\/g, '/');
                    const isExcluded = excludePatterns.some(pattern => this.matchGlob(entry.name, pattern) || this.matchGlob(relativePath, pattern));
                    if (!isExcluded)
                    {
                        files.push(fullPath);
                    }
                }
            }
        };

        walk(dir);
        return files;
    }

    private findFiles(dir: string, patterns: string[]): string[]
    {
        const files: string[] = [];

        const walk = (currentDir: string): void =>
        {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries)
            {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory())
                {
                    walk(fullPath);
                }
                else if (entry.isFile())
                {
                    const relativePath = path.relative(dir, fullPath);
                    if (this.matchesPatterns(relativePath, patterns, dir))
                    {
                        files.push(fullPath);
                    }
                }
            }
        };

        walk(dir);
        return files;
    }

    private matchesPatterns(filePath: string, patterns: string[], baseDir: string): boolean
    {
        for (const pattern of patterns)
        {
            const patternPath = path.join(baseDir, pattern);
            if (fs.existsSync(patternPath) && fs.statSync(patternPath)
                .isDirectory())
            {
                const normalizedFile = filePath.replace(/\\/g, '/');
                const normalizedPattern = pattern.replace(/\\/g, '/');
                if (normalizedFile.startsWith(normalizedPattern + '/') || normalizedFile === normalizedPattern)
                {
                    return true;
                }
            }
            else if (this.matchGlob(filePath, pattern))
            {
                return true;
            }
        }
        return false;
    }

    private matchGlob(filePath: string, pattern: string): boolean
    {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const isMatch: (path: string) => boolean = picomatch(pattern, { dot: false });
        return isMatch(normalizedPath);
    }

    private async copyAssets(assets: string[], projectRoot: string, srcDir: string, outDir: string, indexHtml?: string): Promise<void>
    {
        const compiler = new ComponentCompiler();

        for (const asset of assets)
        {
            const assetPath = path.resolve(srcDir, asset);

            if (fs.existsSync(assetPath) && fs.statSync(assetPath)
                .isDirectory())
            {
                const dirName = path.basename(assetPath);
                const targetDir = path.join(outDir, dirName);
                await this.copyDirectoryRecursive(assetPath, targetDir, compiler);
                console.log(`   ✓ Copied directory ${dirName}/`);
            }
            else
            {
                const files = this.findFiles(srcDir, [asset]);
                for (const filePath of files)
                {
                    if (filePath.endsWith('.component.ts')) continue;
                    if (filePath.endsWith('.component.html')) continue;
                    if (filePath.endsWith('.component.css')) continue;

                    const relativePath = path.relative(srcDir, filePath);
                    if (indexHtml && relativePath === indexHtml) continue;
                    const outPath = path.join(outDir, relativePath);

                    const outFileDir = path.dirname(outPath);
                    if (!fs.existsSync(outFileDir))
                    {
                        fs.mkdirSync(outFileDir, { recursive: true });
                    }

                    if (filePath.endsWith('.ts'))
                    {
                        let content = fs.readFileSync(filePath, 'utf-8');
                        content = await compiler.stripTypeScript(content, filePath);
                        fs.writeFileSync(outPath.replace('.ts', '.js'), content);
                        console.log(`   ✓ Processed ${relativePath}`);
                    }
                    else
                    {
                        fs.copyFileSync(filePath, outPath);
                        console.log(`   ✓ Copied ${relativePath}`);
                    }
                }
            }
        }
    }

    private copyAssetsForServe(assets: string[], projectRoot: string, srcDir: string, outDir: string, indexHtml?: string): void
    {
        for (const asset of assets)
        {
            const assetPath = path.resolve(srcDir, asset);

            if (fs.existsSync(assetPath) && fs.statSync(assetPath)
                .isDirectory())
            {
                const dirName = path.basename(assetPath);
                const targetDir = path.join(outDir, dirName);
                this.copyDirectoryRecursiveSync(assetPath, targetDir);
            }
            else
            {
                const files = this.findFiles(srcDir, [asset]);
                for (const filePath of files)
                {
                    if (filePath.endsWith('.component.ts')) continue;
                    if (filePath.endsWith('.component.html')) continue;
                    if (filePath.endsWith('.component.css')) continue;
                    if (filePath.endsWith('.ts')) continue;

                    const relativePath = path.relative(srcDir, filePath);
                    if (indexHtml && relativePath === indexHtml) continue;
                    const outPath = path.join(outDir, relativePath);

                    const outFileDir = path.dirname(outPath);
                    if (!fs.existsSync(outFileDir))
                    {
                        fs.mkdirSync(outFileDir, { recursive: true });
                    }

                    fs.copyFileSync(filePath, outPath);
                }
            }
        }
    }

    private async copyDirectoryRecursive(srcPath: string, destPath: string, compiler: ComponentCompiler): Promise<void>
    {
        if (!fs.existsSync(destPath))
        {
            fs.mkdirSync(destPath, { recursive: true });
        }

        const entries = fs.readdirSync(srcPath, { withFileTypes: true });
        for (const entry of entries)
        {
            const srcEntry = path.join(srcPath, entry.name);
            const destEntry = path.join(destPath, entry.name);

            if (entry.isDirectory())
            {
                await this.copyDirectoryRecursive(srcEntry, destEntry, compiler);
            }
            else if (entry.isFile())
            {
                if (srcEntry.endsWith('.ts'))
                {
                    let content = fs.readFileSync(srcEntry, 'utf-8');
                    content = await compiler.stripTypeScript(content, srcEntry);
                    fs.writeFileSync(destEntry.replace('.ts', '.js'), content);
                }
                else
                {
                    fs.copyFileSync(srcEntry, destEntry);
                }
            }
        }
    }

    private copyDirectoryRecursiveSync(srcPath: string, destPath: string): void
    {
        if (!fs.existsSync(destPath))
        {
            fs.mkdirSync(destPath, { recursive: true });
        }

        const entries = fs.readdirSync(srcPath, { withFileTypes: true });
        for (const entry of entries)
        {
            const srcEntry = path.join(srcPath, entry.name);
            const destEntry = path.join(destPath, entry.name);

            if (entry.isDirectory())
            {
                this.copyDirectoryRecursiveSync(srcEntry, destEntry);
            }
            else if (entry.isFile())
            {
                if (!srcEntry.endsWith('.ts'))
                {
                    fs.copyFileSync(srcEntry, destEntry);
                }
            }
        }
    }
}
