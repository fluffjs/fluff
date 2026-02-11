import * as t from '@babel/types';
import { type DefaultTreeAdapterMap, html } from 'parse5';
import * as path from 'path';
import type { ClassTransformContext, EntryPointContext, FluffConfig, FluffPlugin } from './PluginInterfaces.js';

interface ExtractedRouteConfig
{
    readonly filePath: string;
    readonly selector: string;
    readonly className: string;
    readonly path: string;
    readonly guardClassNames: readonly string[];
    readonly guardImports: ReadonlyMap<string, string>;
    readonly redirectTo?: string;
    readonly pathMatch: 'full' | 'prefix';
    readonly childClassNames: readonly string[];
    readonly routerFieldName: string;
}

export class RouterPlugin implements FluffPlugin
{
    public readonly name = '@fluffjs/router';

    private readonly routedComponents = new Map<string, ExtractedRouteConfig>();
    private basePath = '';

    public afterConfig(config: FluffConfig, pluginConfig: Record<string, unknown>): void
    {
        if (typeof pluginConfig.basePath === 'string')
        {
            this.basePath = pluginConfig.basePath;
        }

        for (const target of Object.values(config.targets))
        {
            target.bundle ??= {};
            target.bundle.splitting = true;
        }
    }

    public modifyIndexHtml(document: DefaultTreeAdapterMap['document']): void
    {
        const head = RouterPlugin.findElement(document, 'head');
        if (!head)
        {
            return;
        }

        const basePath = this.basePath || '/';
        const baseEl: DefaultTreeAdapterMap['element'] = {
            nodeName: 'base',
            tagName: 'base',
            namespaceURI: html.NS.HTML,
            attrs: [{ name: 'href', value: basePath }],
            childNodes: [],
            parentNode: head,
            sourceCodeLocation: undefined
        };

        head.childNodes.unshift(baseEl);
    }

    public beforeClassTransform(context: ClassTransformContext): void
    {
        const { ast, filePath, metadata } = context;

        for (const node of ast.program.body)
        {
            const classNode = RouterPlugin.extractClassDeclaration(node);
            if (!classNode)
            {
                continue;
            }

            const result = this.processClass(classNode, ast.program, filePath, metadata.selector, metadata.className);
            if (result)
            {
                this.routedComponents.set(filePath, result);
            }
        }
    }

    public modifyEntryPoint(context: EntryPointContext): void
    {
        this.removeRoutedComponentImports(context.program, context.srcDir);
        this.addRouteRegistration(context.program);
    }

    public getRoutedComponentPaths(): ReadonlySet<string>
    {
        return new Set(this.routedComponents.keys());
    }

    private processClass(
        classNode: t.ClassDeclaration,
        program: t.Program,
        filePath: string,
        selector: string,
        className: string
    ): ExtractedRouteConfig | null
    {
        const classBody = classNode.body;
        let routerFieldName: string | null = null;
        let routeConfig: {
            path: string;
            guardClassNames: string[];
            redirectTo?: string;
            pathMatch: 'full' | 'prefix';
            childClassNames: string[];
        } | null = null;

        let routerPropertyIndex = -1;

        for (let i = 0; i < classBody.body.length; i++)
        {
            const member = classBody.body[i];
            if (!t.isClassProperty(member))
            {
                continue;
            }

            const decorators = member.decorators ?? [];
            const routerDecoratorIdx = decorators.findIndex(dec =>
                t.isCallExpression(dec.expression) &&
                t.isIdentifier(dec.expression.callee) &&
                dec.expression.callee.name === 'Router'
            );

            if (routerDecoratorIdx < 0)
            {
                continue;
            }

            if (routerFieldName !== null)
            {
                throw new Error(
                    `Component '${className}' in '${filePath}' has multiple @Router decorators. Only one is allowed per component.`
                );
            }

            if (!t.isIdentifier(member.key))
            {
                continue;
            }

            routerFieldName = member.key.name;
            routerPropertyIndex = i;

            const decorator = decorators[routerDecoratorIdx];
            if (!t.isCallExpression(decorator.expression))
            {
                continue;
            }

            routeConfig = this.extractRouteConfigFromDecorator(decorator.expression);

            decorators.splice(routerDecoratorIdx, 1);
            if (decorators.length === 0)
            {
                member.decorators = null;
            }
        }

        if (!routerFieldName || !routeConfig)
        {
            return null;
        }

        const staticRouterField = t.classProperty(
            t.identifier('__routerField'),
            t.stringLiteral(routerFieldName)
        );
        staticRouterField.static = true;

        classBody.body.splice(routerPropertyIndex, 0, staticRouterField);

        const guardImports = RouterPlugin.resolveGuardImports(
            program, routeConfig.guardClassNames, filePath
        );

        return {
            filePath,
            selector,
            className,
            path: routeConfig.path,
            guardClassNames: routeConfig.guardClassNames,
            guardImports,
            redirectTo: routeConfig.redirectTo,
            pathMatch: routeConfig.pathMatch,
            childClassNames: routeConfig.childClassNames,
            routerFieldName
        };
    }

    private extractRouteConfigFromDecorator(callExpr: t.CallExpression): {
        path: string;
        guardClassNames: string[];
        redirectTo?: string;
        pathMatch: 'full' | 'prefix';
        childClassNames: string[];
    }
    {
        const result = {
            path: '',
            guardClassNames: [] as string[],
            redirectTo: undefined as string | undefined,
            pathMatch: 'prefix' as 'full' | 'prefix',
            childClassNames: [] as string[]
        };

        const [arg] = callExpr.arguments;
        if (!arg || !t.isObjectExpression(arg))
        {
            return result;
        }

        for (const prop of arg.properties)
        {
            if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key))
            {
                continue;
            }

            switch (prop.key.name)
            {
                case 'path':
                    if (t.isStringLiteral(prop.value))
                    {
                        result.path = prop.value.value;
                    }
                    break;

                case 'guard':
                    if (t.isArrayExpression(prop.value))
                    {
                        for (const el of prop.value.elements)
                        {
                            if (t.isIdentifier(el))
                            {
                                result.guardClassNames.push(el.name);
                            }
                        }
                    }
                    break;

                case 'redirectTo':
                    if (t.isStringLiteral(prop.value))
                    {
                        result.redirectTo = prop.value.value;
                    }
                    break;

                case 'pathMatch':
                    if (t.isStringLiteral(prop.value) && (prop.value.value === 'full' || prop.value.value === 'prefix'))
                    {
                        result.pathMatch = prop.value.value;
                    }
                    break;

                case 'children':
                    if (t.isArrayExpression(prop.value))
                    {
                        for (const el of prop.value.elements)
                        {
                            if (t.isIdentifier(el))
                            {
                                result.childClassNames.push(el.name);
                            }
                        }
                    }
                    break;
            }
        }

        return result;
    }

    private removeRoutedComponentImports(program: t.Program, srcDir: string): void
    {
        const routedAbsolutePaths = new Set<string>();
        for (const config of this.routedComponents.values())
        {
            routedAbsolutePaths.add(path.resolve(config.filePath));
        }

        program.body = program.body.filter(node =>
        {
            if (!t.isImportDeclaration(node))
            {
                return true;
            }

            const importSource = node.source.value;
            const resolved = path.resolve(srcDir, importSource.replace(/\.js$/, '.ts'));

            return !routedAbsolutePaths.has(resolved);
        });
    }

    private addRouteRegistration(program: t.Program): void
    {
        if (this.routedComponents.size === 0)
        {
            return;
        }

        const statements: t.Statement[] = [];

        statements.push(
            t.importDeclaration(
                [t.importSpecifier(t.identifier('RouteRegistry'), t.identifier('RouteRegistry'))],
                t.stringLiteral('@fluffjs/router/runtime')
            )
        );
        statements.push(
            t.importDeclaration(
                [t.importSpecifier(t.identifier('RouterOutlet'), t.identifier('RouterOutlet'))],
                t.stringLiteral('@fluffjs/router/runtime')
            )
        );
        statements.push(
            t.importDeclaration(
                [t.importSpecifier(t.identifier('FluffRouter'), t.identifier('FluffRouter'))],
                t.stringLiteral('@fluffjs/router/runtime')
            )
        );

        const registryVar = t.variableDeclaration('const', [
            t.variableDeclarator(
                t.identifier('__registry'),
                t.callExpression(
                    t.memberExpression(t.identifier('RouteRegistry'), t.identifier('getInstance')),
                    []
                )
            )
        ]);
        statements.push(registryVar);

        if (this.basePath)
        {
            statements.push(
                t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(t.identifier('__registry'), t.identifier('setBasePath')),
                        [t.stringLiteral(this.basePath)]
                    )
                )
            );
        }

        const allGuardImports = new Map<string, string>();
        for (const config of this.routedComponents.values())
        {
            for (const [guardName, guardPath] of config.guardImports)
            {
                allGuardImports.set(guardName, guardPath);
            }
        }

        for (const [guardName, guardPath] of allGuardImports)
        {
            const importPath = this.resolveImportPath(guardPath);
            statements.push(
                t.importDeclaration(
                    [t.importSpecifier(t.identifier(guardName), t.identifier(guardName))],
                    t.stringLiteral(importPath)
                )
            );
        }

        const childClassToConfig = new Map<string, ExtractedRouteConfig>();
        for (const config of this.routedComponents.values())
        {
            childClassToConfig.set(config.className, config);
        }

        for (const config of this.routedComponents.values())
        {
            const isChild = this.isChildRoute(config.className);
            if (isChild)
            {
                continue;
            }

            const entryExpr = this.buildRouteEntryExpression(config, childClassToConfig);

            statements.push(
                t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(t.identifier('__registry'), t.identifier('register')),
                        [entryExpr]
                    )
                )
            );
        }

        statements.push(
            t.ifStatement(
                t.unaryExpression('!', t.callExpression(
                    t.memberExpression(t.identifier('customElements'), t.identifier('get')),
                    [t.stringLiteral('router-outlet')]
                )),
                t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(t.identifier('customElements'), t.identifier('define')),
                        [t.stringLiteral('router-outlet'), t.identifier('RouterOutlet')]
                    )
                )
            )
        );

        statements.push(
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.identifier('FluffRouter'), t.identifier('enableLinkInterception')),
                    []
                )
            )
        );

        program.body.push(...statements);
    }

    private buildRouteEntryExpression(
        config: ExtractedRouteConfig,
        childClassToConfig: Map<string, ExtractedRouteConfig>
    ): t.ObjectExpression
    {
        const props: t.ObjectProperty[] = [];

        props.push(t.objectProperty(t.identifier('path'), t.stringLiteral(config.path)));

        props.push(t.objectProperty(
            t.identifier('selector'),
            t.stringLiteral(config.selector)
        ));

        const importPath = this.resolveImportPath(config.filePath);
        props.push(t.objectProperty(
            t.identifier('componentLoader'),
            t.arrowFunctionExpression(
                [],
                t.callExpression(
                    t.memberExpression(
                        t.callExpression(t.import(), [t.stringLiteral(importPath)]),
                        t.identifier('then')
                    ),
                    [
                        t.arrowFunctionExpression(
                            [t.identifier('m')],
                            t.memberExpression(t.identifier('m'), t.identifier(config.className))
                        )
                    ]
                )
            )
        ));

        props.push(t.objectProperty(
            t.identifier('guard'),
            t.arrayExpression(
                config.guardClassNames.map(name => t.identifier(name))
            )
        ));

        if (config.redirectTo !== undefined)
        {
            props.push(t.objectProperty(
                t.identifier('redirectTo'),
                t.stringLiteral(config.redirectTo)
            ));
        }

        props.push(t.objectProperty(
            t.identifier('pathMatch'),
            t.stringLiteral(config.pathMatch)
        ));

        const childEntries: t.Expression[] = [];
        for (const childClassName of config.childClassNames)
        {
            const childConfig = childClassToConfig.get(childClassName);
            if (childConfig)
            {
                childEntries.push(this.buildRouteEntryExpression(childConfig, childClassToConfig));
            }
        }

        props.push(t.objectProperty(
            t.identifier('children'),
            t.arrayExpression(childEntries)
        ));

        props.push(t.objectProperty(
            t.identifier('isWildcard'),
            t.booleanLiteral(config.path === '**')
        ));

        return t.objectExpression(props);
    }

    private isChildRoute(className: string): boolean
    {
        for (const config of this.routedComponents.values())
        {
            if (config.childClassNames.includes(className))
            {
                return true;
            }
        }
        return false;
    }

    private resolveImportPath(filePath: string): string
    {
        return filePath.replace(/\.ts$/, '.js');
    }

    private static findElement(
        node: DefaultTreeAdapterMap['node'],
        tagName: string
    ): DefaultTreeAdapterMap['element'] | null
    {
        if ('tagName' in node && node.tagName === tagName)
        {
            return node as DefaultTreeAdapterMap['element'];
        }
        if ('childNodes' in node)
        {
            for (const child of (node as DefaultTreeAdapterMap['parentNode']).childNodes)
            {
                const found = RouterPlugin.findElement(child, tagName);
                if (found)
                {
                    return found;
                }
            }
        }
        return null;
    }

    private static resolveGuardImports(
        program: t.Program,
        guardClassNames: readonly string[],
        componentFilePath: string
    ): Map<string, string>
    {
        const guardImports = new Map<string, string>();
        if (guardClassNames.length === 0)
        {
            return guardImports;
        }

        const guardSet = new Set(guardClassNames);
        const componentDir = path.dirname(componentFilePath);

        for (const node of program.body)
        {
            if (!t.isImportDeclaration(node))
            {
                continue;
            }

            for (const specifier of node.specifiers)
            {
                if (t.isImportSpecifier(specifier) &&
                    t.isIdentifier(specifier.imported) &&
                    guardSet.has(specifier.imported.name))
                {
                    const importSource = node.source.value;
                    const resolved = path.resolve(
                        componentDir, importSource.replace(/\.js$/, '.ts')
                    );
                    guardImports.set(specifier.imported.name, resolved);
                }
            }
        }

        return guardImports;
    }

    private static extractClassDeclaration(node: t.Statement): t.ClassDeclaration | null
    {
        if (t.isClassDeclaration(node))
        {
            return node;
        }
        if (t.isExportNamedDeclaration(node) && t.isClassDeclaration(node.declaration))
        {
            return node.declaration;
        }
        if (t.isExportDefaultDeclaration(node) && t.isClassDeclaration(node.declaration))
        {
            return node.declaration;
        }
        return null;
    }
}
