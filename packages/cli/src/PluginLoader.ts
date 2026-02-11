import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import type { FluffConfig } from './interfaces/FluffConfigInterface.js';
import type { FluffPlugin } from './interfaces/FluffPlugin.js';
import { PluginManager } from './PluginManager.js';
import { Typeguards } from './Typeguards.js';

interface NxProjectConfiguration
{
    root: string;
    sourceRoot?: string;
    targets?: Record<string, unknown>;
}

interface NxProjectGraph
{
    nodes: Record<string, { data: NxProjectConfiguration }>;
}

export class PluginLoader
{
    public static async load(config: FluffConfig, projectRoot: string): Promise<PluginManager>
    {
        const manager = new PluginManager();

        if (!config.plugins || config.plugins.length === 0)
        {
            return manager;
        }

        for (const pluginSpec of config.plugins)
        {
            const plugin = await PluginLoader.loadPlugin(pluginSpec, projectRoot);
            manager.registerPlugin(plugin);
        }

        manager.resolveExecutionOrder();

        return manager;
    }

    private static async loadPlugin(spec: string, projectRoot: string): Promise<FluffPlugin>
    {
        const modulePath = await PluginLoader.resolvePluginPath(spec, projectRoot);

        const loaded: unknown = await import(modulePath).catch((e: unknown) =>
        {
            throw new Error(
                `Failed to load plugin '${spec}' from '${modulePath}': ${e instanceof Error ? e.message : String(e)}`
            );
        });

        const plugin = PluginLoader.extractPlugin(loaded);
        if (!plugin)
        {
            throw new Error(
                `Plugin '${spec}' does not export a valid FluffPlugin. ` +
                'Expected a default export with a \'name\' property, or a default export function that returns one.'
            );
        }

        return plugin;
    }

    private static async resolvePluginPath(spec: string, projectRoot: string): Promise<string>
    {
        const absoluteProjectRoot = path.resolve(projectRoot);

        const nxResult = await PluginLoader.tryResolveViaNx(spec, absoluteProjectRoot);
        if (nxResult)
        {
            return nxResult;
        }

        const packageJsonResult = PluginLoader.tryResolveViaPackageJson(spec, absoluteProjectRoot);
        if (packageJsonResult)
        {
            return packageJsonResult;
        }

        const nodeModulesResult = PluginLoader.tryResolveViaNodeModules(spec, absoluteProjectRoot);
        if (nodeModulesResult)
        {
            return nodeModulesResult;
        }

        const directPathResult = PluginLoader.tryResolveAsDirectPath(spec, absoluteProjectRoot);
        if (directPathResult)
        {
            return directPathResult;
        }

        const directoryResult = PluginLoader.tryResolveAsDirectory(spec, absoluteProjectRoot);
        if (directoryResult)
        {
            return directoryResult;
        }

        throw new Error(
            `Plugin '${spec}' not found. Searched:\n` +
            '  - nx workspace packages\n' +
            '  - package.json overrides/resolutions\n' +
            '  - node_modules\n' +
            '  - direct file path\n' +
            '  - directory with package.json'
        );
    }

    private static async tryResolveViaNx(spec: string, projectRoot: string): Promise<string | null>
    {
        const nxJsonPath = PluginLoader.findFileUpwards('nx.json', projectRoot);
        if (!nxJsonPath)
        {
            return null;
        }

        const workspaceRoot = path.dirname(nxJsonPath);

        const manualResult = PluginLoader.tryResolveNxManually(spec, workspaceRoot);
        if (manualResult)
        {
            return manualResult;
        }

        try
        {
            const devkit: { createProjectGraphAsync: () => Promise<NxProjectGraph> } =
                await import('@nx/devkit');

            const graph = await devkit.createProjectGraphAsync();
            const projectNode = graph.nodes[spec];

            if (!projectNode)
            {
                return null;
            }

            const nxProjectRoot = path.resolve(workspaceRoot, projectNode.data.root);
            return PluginLoader.resolvePackageEntryPoint(nxProjectRoot);
        }
        catch
        {
            return null;
        }
    }

    private static tryResolveNxManually(spec: string, workspaceRoot: string): string | null
    {
        const searchDirs = ['packages', 'apps', 'libs'];

        for (const searchDir of searchDirs)
        {
            const dirPath = path.join(workspaceRoot, searchDir);
            if (!fs.existsSync(dirPath))
            {
                continue;
            }

            const entries = PluginLoader.safeReadDir(dirPath);
            if (!entries)
            {
                continue;
            }

            for (const entry of entries)
            {
                if (!entry.isDirectory())
                {
                    continue;
                }

                const candidatePath = path.join(dirPath, entry.name);
                const pkgJsonPath = path.join(candidatePath, 'package.json');

                if (!fs.existsSync(pkgJsonPath))
                {
                    continue;
                }

                const pkgName = PluginLoader.readPackageName(pkgJsonPath);
                if (pkgName === spec)
                {
                    return PluginLoader.resolvePackageEntryPoint(candidatePath);
                }
            }
        }

        return null;
    }

    private static tryResolveViaPackageJson(spec: string, projectRoot: string): string | null
    {
        const pkgJsonPath = PluginLoader.findFileUpwards('package.json', projectRoot);
        if (!pkgJsonPath)
        {
            return null;
        }

        const pkgJson = PluginLoader.readJsonFile(pkgJsonPath);
        if (!pkgJson)
        {
            return null;
        }

        const overridesVal = pkgJson.overrides;
        const overrides = Typeguards.isRecord(overridesVal) ? overridesVal : undefined;
        const resolutionsVal = pkgJson.resolutions;
        const resolutions = Typeguards.isRecord(resolutionsVal) ? resolutionsVal : undefined;

        const resolved = overrides?.[spec] ?? resolutions?.[spec];

        if (typeof resolved !== 'string')
        {
            return null;
        }

        if (resolved.startsWith('.') || resolved.startsWith('/'))
        {
            const rootDir = path.dirname(pkgJsonPath);
            const resolvedPath = path.resolve(rootDir, resolved);
            if (fs.existsSync(resolvedPath))
            {
                if (fs.statSync(resolvedPath).isDirectory())
                {
                    return PluginLoader.resolvePackageEntryPoint(resolvedPath);
                }
                return resolvedPath;
            }
        }

        return null;
    }

    private static tryResolveViaNodeModules(spec: string, projectRoot: string): string | null
    {
        try
        {
            const require = createRequire(path.join(projectRoot, 'noop.js'));
            return require.resolve(spec);
        }
        catch
        {
            return null;
        }
    }

    private static tryResolveAsDirectPath(spec: string, projectRoot: string): string | null
    {
        const resolved = path.isAbsolute(spec) ? spec : path.resolve(projectRoot, spec);

        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile())
        {
            return resolved;
        }

        const extensions = ['.js', '.mjs', '.ts', '.mts'];
        for (const ext of extensions)
        {
            const withExt = resolved + ext;
            if (fs.existsSync(withExt) && fs.statSync(withExt).isFile())
            {
                return withExt;
            }
        }

        return null;
    }

    private static tryResolveAsDirectory(spec: string, projectRoot: string): string | null
    {
        const resolved = path.isAbsolute(spec) ? spec : path.resolve(projectRoot, spec);

        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
        {
            return null;
        }

        return PluginLoader.resolvePackageEntryPoint(resolved);
    }

    private static resolvePackageEntryPoint(dir: string): string | null
    {
        const pkgJsonPath = path.join(dir, 'package.json');

        if (fs.existsSync(pkgJsonPath))
        {
            const pkgJson = PluginLoader.readJsonFile(pkgJsonPath);
            if (!pkgJson)
            {
                return null;
            }

            const entryPoint = PluginLoader.extractEntryFromPackageJson(pkgJson);
            if (entryPoint)
            {
                const fullPath = path.resolve(dir, entryPoint);
                if (fs.existsSync(fullPath))
                {
                    return fullPath;
                }
            }
        }

        const fallbacks = ['index.js', 'index.mjs', 'dist/index.js', 'dist/index.mjs'];
        for (const fallback of fallbacks)
        {
            const candidate = path.join(dir, fallback);
            if (fs.existsSync(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static extractEntryFromPackageJson(pkgJson: Record<string, unknown>): string | null
    {
        const { exports } = pkgJson;
        if (exports && typeof exports === 'object')
        {
            if (Typeguards.isRecord(exports))
            {
                const dotExport = exports['.'];

                if (typeof dotExport === 'string')
                {
                    return dotExport;
                }

                if (Typeguards.isRecord(dotExport))
                {
                    if (typeof dotExport.import === 'string')
                    {
                        return dotExport.import;
                    }
                    if (typeof dotExport.default === 'string')
                    {
                        return dotExport.default;
                    }
                }
            }
        }

        if (typeof pkgJson.module === 'string')
        {
            return pkgJson.module;
        }

        if (typeof pkgJson.main === 'string')
        {
            return pkgJson.main;
        }

        return null;
    }

    private static readPackageName(pkgJsonPath: string): string | null
    {
        const content = PluginLoader.readJsonFile(pkgJsonPath);
        if (!content)
        {
            return null;
        }
        return typeof content.name === 'string' ? content.name : null;
    }

    private static readJsonFile(filePath: string): Record<string, unknown> | null
    {
        try
        {
            const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (Typeguards.isRecord(raw))
            {
                return raw;
            }
            return null;
        }
        catch
        {
            return null;
        }
    }

    private static safeReadDir(dirPath: string): fs.Dirent[] | null
    {
        try
        {
            return fs.readdirSync(dirPath, { withFileTypes: true });
        }
        catch
        {
            return null;
        }
    }

    private static findFileUpwards(filename: string, startDir: string): string | null
    {
        let dir = startDir;
        while (dir !== path.dirname(dir))
        {
            const filePath = path.join(dir, filename);
            if (fs.existsSync(filePath))
            {
                return filePath;
            }
            dir = path.dirname(dir);
        }
        return null;
    }

    private static extractPlugin(loaded: unknown): FluffPlugin | null
    {
        if (!Typeguards.isRecord(loaded))
        {
            return null;
        }

        if ('default' in loaded)
        {
            const defaultExport = loaded.default;

            if (typeof defaultExport === 'function')
            {
                const result: unknown = defaultExport();
                if (PluginLoader.isFluffPlugin(result))
                {
                    return result;
                }
            }

            if (PluginLoader.isFluffPlugin(defaultExport))
            {
                return defaultExport;
            }
        }

        if (PluginLoader.isFluffPlugin(loaded))
        {
            return loaded;
        }

        return null;
    }

    private static isFluffPlugin(value: unknown): value is FluffPlugin
    {
        return value !== null
            && typeof value === 'object'
            && 'name' in value
            && typeof (value as Record<string, unknown>).name === 'string';
    }
}
