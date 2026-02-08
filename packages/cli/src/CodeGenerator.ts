import { parse } from '@babel/parser';
import * as t from '@babel/types';
import * as parse5 from 'parse5';
import { generate, parseMethodBody } from './BabelHelpers.js';
import { ExpressionTransformer } from './ExpressionTransformer.js';
import type { BreakMarkerConfig } from './interfaces/BreakMarkerConfig.js';
import type { ForMarkerConfig } from './interfaces/ForMarkerConfig.js';
import type { IfMarkerConfig } from './interfaces/IfMarkerConfig.js';
import type { SwitchMarkerConfig } from './interfaces/SwitchMarkerConfig.js';
import type { TextMarkerConfig } from './interfaces/TextMarkerConfig.js';
import { Parse5Helpers } from './Parse5Helpers.js';
import type {
    CommentNode,
    ElementNode,
    ForNode,
    IfNode,
    InterpolationNode,
    PropertyChain,
    ParsedTemplate,
    SwitchNode,
    TemplateNode,
    TextNode
} from './TemplateParser.js';
import type { Parse5DocumentFragment, Parse5Element } from './Typeguards.js';

export type { BreakMarkerConfig } from './interfaces/BreakMarkerConfig.js';
export type { ForMarkerConfig } from './interfaces/ForMarkerConfig.js';
export type { IfMarkerConfig } from './interfaces/IfMarkerConfig.js';
export type { SwitchMarkerConfig } from './interfaces/SwitchMarkerConfig.js';
export type { TextMarkerConfig } from './interfaces/TextMarkerConfig.js';

const RESTRICTED_ELEMENT_PREFIX = 'x-fluff-el-';

export type MarkerConfig = IfMarkerConfig | ForMarkerConfig | SwitchMarkerConfig | TextMarkerConfig | BreakMarkerConfig;

const BIND_PROPERTY = 0;
const BIND_EVENT = 1;
const BIND_TWO_WAY = 2;
const BIND_CLASS = 3;
const BIND_STYLE = 4;
const BIND_REF = 5;

const BINDING_TYPE_MAP: Record<string, number> = {
    'property': BIND_PROPERTY,
    'event': BIND_EVENT,
    'two-way': BIND_TWO_WAY,
    'class': BIND_CLASS,
    'style': BIND_STYLE,
    'ref': BIND_REF
};

/**
 * Compact Binding Format (Encoder)
 *
 * Bindings are serialized as tuples to minimize bundle size. All strings are
 * interned into a global string table and referenced by index.
 *
 * Format: [nameIdx, bindType, deps, id, extras?]
 *
 * - nameIdx: Index into global string table for the binding name (e.g., "value", "click")
 * - bindType: Numeric binding type (0=property, 1=event, 2=two-way, 3=class, 4=style, 5=ref)
 * - deps: Array of interned dependency chains, or null. Each dep is either:
 *         - A single index (for simple property like "foo")
 *         - An array of indices (for nested property chain like ["device", "name"])
 * - id: Expression ID (for property/two-way/class/style) or Handler ID (for event), or null
 * - extras: Optional object with additional binding metadata:
 *           - t: Target property name for two-way bindings
 *           - s: Subscribe source name
 *           - p: Pipes array of [pipeNameIdx, argExprIds[]]
 *
 * The global string table is passed to FluffBase.__setExpressionTable() as the third argument.
 * The runtime decodes these compact bindings back to BindingInfo objects.
 */
export type CompactDep = number | number[];

export type CompactBinding = [
    number,
    number,
    CompactDep[] | null,
    number | null,
    Record<string, unknown>?
];

export class CodeGenerator
{
    private readonly componentSelectors: Set<string>;
    private readonly componentSelector: string;
    private static readonly globalExprIdsByExpr = new Map<string, number>();
    private static globalExprs: string[] = [];
    private static readonly globalHandlerIdsByExpr = new Map<string, number>();
    private static globalHandlers: string[] = [];
    private static readonly globalStringTable: string[] = [];
    private static readonly globalStringIndices = new Map<string, number>();

    private markerId = 0;
    private readonly markerConfigs = new Map<number, MarkerConfig>();
    private readonly usedExprIds: number[] = [];
    private readonly usedHandlerIds: number[] = [];
    private readonly bindingsMap = new Map<string, CompactBinding[]>();
    private rootFragment: Parse5DocumentFragment | null = null;
    private readonly collectedTemplates: Parse5Element[] = [];

    public constructor(componentSelectors: Set<string> = new Set<string>(), componentSelector = '')
    {
        this.componentSelectors = componentSelectors;
        this.componentSelector = componentSelector;
    }

    public static resetGlobalState(): void
    {
        CodeGenerator.globalExprIdsByExpr.clear();
        CodeGenerator.globalExprs = [];
        CodeGenerator.globalHandlerIdsByExpr.clear();
        CodeGenerator.globalHandlers = [];
        CodeGenerator.globalStringTable.length = 0;
        CodeGenerator.globalStringIndices.clear();
    }

    public static internString(str: string): number
    {
        const existing = CodeGenerator.globalStringIndices.get(str);
        if (existing !== undefined)
        {
            return existing;
        }
        const id = CodeGenerator.globalStringTable.length;
        CodeGenerator.globalStringTable.push(str);
        CodeGenerator.globalStringIndices.set(str, id);
        return id;
    }

    public static getStringTable(): string[]
    {
        return CodeGenerator.globalStringTable;
    }

    public generateRenderMethod(template: ParsedTemplate, styles?: string): string
    {
        this.markerId = 0;
        this.markerConfigs.clear();

        const html = this.generateHtml(template);
        const markerConfigExpr = this.getMarkerConfigExpression();

        return this.generateRenderMethodFromHtml(html, styles, markerConfigExpr);
    }

    public generateHtml(template: ParsedTemplate): string
    {
        this.rootFragment = parse5.parseFragment('');
        this.collectedTemplates.length = 0;

        this.renderNodesToParent(template.root, this.rootFragment);

        for (const tpl of this.collectedTemplates)
        {
            tpl.parentNode = this.rootFragment;
            this.rootFragment.childNodes.push(tpl);
        }

        return parse5.serialize(this.rootFragment);
    }

    public generateRenderMethodFromHtml(html: string, styles?: string, markerConfigExpr?: t.Expression): string
    {
        let content = html;
        if (styles)
        {
            const fragment = parse5.parseFragment(html);
            const styleElement = Parse5Helpers.createElement('style', []);
            Parse5Helpers.appendText(styleElement, styles);
            fragment.childNodes.push(styleElement);
            styleElement.parentNode = fragment;
            content = parse5.serialize(fragment);
        }

        const statements: t.Statement[] = [];

        statements.push(
            t.expressionStatement(
                t.assignmentExpression(
                    '=',
                    t.memberExpression(
                        t.callExpression(
                            t.memberExpression(t.thisExpression(), t.identifier('__getShadowRoot')),
                            []
                        ),
                        t.identifier('innerHTML')
                    ),
                    t.stringLiteral(content)
                )
            )
        );

        if (markerConfigExpr)
        {
            statements.push(
                t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(t.thisExpression(), t.identifier('__setMarkerConfigs')),
                        [markerConfigExpr]
                    )
                )
            );
        }

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    public getMarkerConfigExpression(): t.Expression
    {
        return this.buildMarkerConfigExpression();
    }

    private buildMarkerConfigExpression(): t.Expression
    {
        const entries = Array.from(this.markerConfigs.entries())
            .map(([id, config]) => t.arrayExpression([
                t.numericLiteral(id),
                this.buildMarkerConfigArray(config)
            ]));

        return t.arrayExpression(entries);
    }

    private buildMarkerConfigArray(config: MarkerConfig): t.ArrayExpression
    {
        const MARKER_TYPE_MAP: Record<string, number> = {
            'if': 0, 'for': 1, 'text': 2, 'switch': 3, 'break': 4
        };
        const typeNum = MARKER_TYPE_MAP[config.type];

        if (config.type === 'text')
        {
            const elements: t.Expression[] = [
                t.numericLiteral(typeNum),
                t.numericLiteral(config.exprId),
                config.deps ? this.buildCompactDepsExpression(config.deps) : t.nullLiteral(),
                config.pipes && config.pipes.length > 0
                    ? t.arrayExpression(config.pipes.map(pipe => t.arrayExpression([
                        t.numericLiteral(CodeGenerator.internString(pipe.name)),
                        t.arrayExpression(pipe.argExprIds.map(arg => t.numericLiteral(arg)))
                    ])))
                    : t.nullLiteral()
            ];
            return t.arrayExpression(elements);
        }
        else if (config.type === 'if')
        {
            const branches = t.arrayExpression(config.branches.map(branch =>
            {
                if (branch.exprId === undefined && !branch.deps)
                {
                    return t.arrayExpression([]);
                }
                return t.arrayExpression([
                    branch.exprId !== undefined ? t.numericLiteral(branch.exprId) : t.nullLiteral(),
                    branch.deps ? this.buildCompactDepsExpression(branch.deps) : t.nullLiteral()
                ]);
            }));
            return t.arrayExpression([t.numericLiteral(typeNum), branches]);
        }
        else if (config.type === 'for')
        {
            return t.arrayExpression([
                t.numericLiteral(typeNum),
                t.numericLiteral(CodeGenerator.internString(config.iterator)),
                t.numericLiteral(config.iterableExprId),
                t.booleanLiteral(config.hasEmpty),
                config.deps ? this.buildCompactDepsExpression(config.deps) : t.nullLiteral(),
                config.trackBy !== undefined
                    ? t.numericLiteral(CodeGenerator.internString(config.trackBy))
                    : t.nullLiteral()
            ]);
        }
        else if (config.type === 'switch')
        {
            const cases = t.arrayExpression(config.cases.map(caseConfig =>
                t.arrayExpression([
                    t.booleanLiteral(caseConfig.isDefault),
                    t.booleanLiteral(caseConfig.fallthrough),
                    caseConfig.valueExprId !== undefined
                        ? t.numericLiteral(caseConfig.valueExprId)
                        : t.nullLiteral()
                ])
            ));
            return t.arrayExpression([
                t.numericLiteral(typeNum),
                t.numericLiteral(config.expressionExprId),
                config.deps ? this.buildCompactDepsExpression(config.deps) : t.nullLiteral(),
                cases
            ]);
        }
        else if (config.type === 'break')
        {
            return t.arrayExpression([t.numericLiteral(typeNum)]);
        }

        return t.arrayExpression([t.numericLiteral(typeNum)]);
    }

    private buildCompactDepsExpression(deps: PropertyChain[]): t.ArrayExpression
    {
        return t.arrayExpression(deps.map(dep => this.buildCompactPropertyChainExpression(dep)));
    }

    private buildCompactPropertyChainExpression(dep: PropertyChain): t.Expression
    {
        if (Array.isArray(dep))
        {
            return t.arrayExpression(dep.map(part => t.numericLiteral(CodeGenerator.internString(part))));
        }
        return t.numericLiteral(CodeGenerator.internString(dep));
    }

    public generateBindingsSetup(): string
    {
        const statements: t.Statement[] = [
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('__initializeMarkers')),
                    [t.identifier('MarkerManager')]
                )
            ),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.super(), t.identifier('__setupBindings')),
                    []
                )
            )
        ];

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    public getBindingsMap(): Record<string, CompactBinding[]>
    {
        return Object.fromEntries(this.bindingsMap.entries());
    }

    public generateExpressionAssignments(): string
    {
        const statements: t.Statement[] = [];

        for (const id of this.usedExprIds)
        {
            const expr = CodeGenerator.globalExprs[id];
            const normalizedExpr = CodeGenerator.normalizeCompiledExpr(expr);
            const arrowFunc = CodeGenerator.buildExpressionArrowFunction(['t', 'l'], normalizedExpr);

            statements.push(
                t.expressionStatement(
                    t.assignmentExpression(
                        '=',
                        t.memberExpression(
                            t.memberExpression(t.identifier('FluffBase'), t.identifier('__e')),
                            t.numericLiteral(id),
                            true
                        ),
                        arrowFunc
                    )
                )
            );
        }

        for (const id of this.usedHandlerIds)
        {
            const handler = CodeGenerator.globalHandlers[id];
            const normalizedHandler = CodeGenerator.normalizeCompiledExpr(handler);
            const arrowFunc = CodeGenerator.buildHandlerArrowFunction(['t', 'l', '__ev'], normalizedHandler);

            statements.push(
                t.expressionStatement(
                    t.assignmentExpression(
                        '=',
                        t.memberExpression(
                            t.memberExpression(t.identifier('FluffBase'), t.identifier('__h')),
                            t.numericLiteral(id),
                            true
                        ),
                        arrowFunc
                    )
                )
            );
        }

        if (statements.length === 0)
        {
            return '';
        }

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    public static generateGlobalExprTable(): string
    {
        const exprElements = CodeGenerator.globalExprs.map(e =>
        {
            const normalizedExpr = CodeGenerator.normalizeCompiledExpr(e);
            return CodeGenerator.buildExpressionArrowFunction(['t', 'l'], normalizedExpr);
        });

        const handlerElements = CodeGenerator.globalHandlers.map(h =>
        {
            const normalizedHandler = CodeGenerator.normalizeCompiledExpr(h);
            return CodeGenerator.buildHandlerArrowFunction(['t', 'l', '__ev'], normalizedHandler);
        });

        const stringElements = CodeGenerator.globalStringTable.map(s => t.stringLiteral(s));

        const fluffBaseImport = t.importDeclaration(
            [t.importSpecifier(t.identifier('FluffBase'), t.identifier('FluffBase'))],
            t.stringLiteral('@fluffjs/fluff')
        );

        const setExprTableCall = t.expressionStatement(
            t.callExpression(
                t.memberExpression(t.identifier('FluffBase'), t.identifier('__setExpressionTable')),
                [
                    t.arrayExpression(exprElements),
                    t.arrayExpression(handlerElements),
                    t.arrayExpression(stringElements)
                ]
            )
        );

        const program = t.program([fluffBaseImport, setExprTableCall]);
        return generate(program, { compact: false }).code;
    }

    private static buildExpressionArrowFunction(params: string[], bodyExpr: string): t.ArrowFunctionExpression
    {
        const paramNodes = params.map(p => t.identifier(p));
        const exprAst = parse(`(${bodyExpr})`, { sourceType: 'module' });
        const [exprStmt] = exprAst.program.body;
        if (t.isExpressionStatement(exprStmt))
        {
            return t.arrowFunctionExpression(paramNodes, exprStmt.expression);
        }
        return t.arrowFunctionExpression(paramNodes, t.identifier('undefined'));
    }

    private static buildHandlerArrowFunction(params: string[], bodyCode: string): t.ArrowFunctionExpression
    {
        const paramNodes = params.map(p => t.identifier(p));
        const bodyStatements = parseMethodBody(bodyCode);
        return t.arrowFunctionExpression(paramNodes, t.blockStatement(bodyStatements));
    }

    private static normalizeCompiledExpr(expr: string): string
    {
        let result = expr;
        if (result.includes('this'))
        {
            result = ExpressionTransformer.replaceThisExpression(result, 't');
        }
        if (result.includes('$event'))
        {
            result = ExpressionTransformer.renameVariable(result, '$event', '__ev');
        }
        return result;
    }

    private nextMarkerId(): number
    {
        return this.markerId++;
    }

    private renderNodesToParent(nodes: TemplateNode[], parent: Parse5DocumentFragment | Parse5Element): void
    {
        for (const node of nodes)
        {
            this.renderNodeToParent(node, parent);
        }
    }

    private renderNodeToParent(node: TemplateNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        switch (node.type)
        {
            case 'element':
                this.renderElementToParent(node, parent);
                break;
            case 'text':
                this.renderTextToParent(node, parent);
                break;
            case 'interpolation':
                this.renderInterpolationToParent(node, parent);
                break;
            case 'comment':
                this.renderCommentToParent(node, parent);
                break;
            case 'if':
                this.renderIfToParent(node, parent);
                break;
            case 'for':
                this.renderForToParent(node, parent);
                break;
            case 'switch':
                this.renderSwitchToParent(node, parent);
                break;
            case 'break':
                this.renderBreakToParent(parent);
                break;
        }
    }

    private renderElementToParent(node: ElementNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const attrs: { name: string; value: string }[] = [];

        if (this.isComponentTag(node.tagName))
        {
            attrs.push({ name: 'x-fluff-component', value: '' });
        }

        for (const [name, value] of Object.entries(node.attributes))
        {
            attrs.push({ name, value });
        }

        if (node.id)
        {
            attrs.push({ name: 'data-lid', value: node.id });
        }

        if (node.bindings.length > 0)
        {
            if (!node.id)
            {
                throw new Error(`Bindings on <${node.tagName}> require a data-lid`);
            }
            const bindingsPayload = node.bindings.map(b => this.serializeBinding(b));
            this.bindingsMap.set(node.id, bindingsPayload);
        }

        const refBinding = node.bindings.find(binding => binding.binding === 'ref');
        if (refBinding)
        {
            attrs.push({ name: 'data-ref', value: refBinding.name });
        }

        let { tagName } = node;
        if (tagName.startsWith(RESTRICTED_ELEMENT_PREFIX))
        {
            tagName = tagName.slice(RESTRICTED_ELEMENT_PREFIX.length);
        }

        const el = Parse5Helpers.createElement(tagName, attrs);
        Parse5Helpers.appendChild(parent, el);

        this.renderNodesToParent(node.children, el);
    }

    private renderTextToParent(node: TextNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        Parse5Helpers.appendText(parent, node.content);
    }

    private isComponentTag(tagName: string): boolean
    {
        const resolvedTagName = tagName.startsWith(RESTRICTED_ELEMENT_PREFIX)
            ? tagName.slice(RESTRICTED_ELEMENT_PREFIX.length)
            : tagName;
        return this.componentSelectors.has(resolvedTagName);
    }

    private serializeBinding(binding: ElementNode['bindings'][number]): CompactBinding
    {
        const nameIdx = CodeGenerator.internString(binding.name);
        const bindType = BINDING_TYPE_MAP[binding.binding];

        if (binding.binding === 'ref')
        {
            return [nameIdx, bindType, null, null];
        }

        const deps = binding.deps
            ? binding.deps.map(dep => this.internDep(dep))
            : null;

        let id: number | null = null;
        if (binding.binding === 'event')
        {
            if (!binding.expression)
            {
                throw new Error(`Event binding for ${binding.name} is missing expression`);
            }
            id = this.internHandler(binding.expression);
            return [nameIdx, bindType, deps, id];
        }

        if (!binding.expression)
        {
            throw new Error(`Binding for ${binding.name} is missing expression`);
        }
        id = this.internExpression(binding.expression);

        const extras: Record<string, unknown> = {};

        if (binding.binding === 'two-way')
        {
            if (!binding.expression.startsWith('this.'))
            {
                throw new Error(`Two-way binding for ${binding.name} must target a component property`);
            }
            extras.t = binding.expression.slice('this.'.length);
        }

        if (binding.subscribe)
        {
            extras.s = binding.subscribe;
        }

        if (binding.pipes && binding.pipes.length > 0)
        {
            extras.p = binding.pipes.map(pipe => ([
                CodeGenerator.internString(pipe.name),
                pipe.args.map(arg => this.internExpression(arg))
            ]));
        }

        if (Object.keys(extras).length > 0)
        {
            return [nameIdx, bindType, deps, id, extras];
        }

        return [nameIdx, bindType, deps, id];
    }

    private internDep(dep: string | string[]): number | number[]
    {
        if (Array.isArray(dep))
        {
            return dep.map(s => CodeGenerator.internString(s));
        }
        return CodeGenerator.internString(dep);
    }

    private internExpression(expr: string): number
    {
        const existing = CodeGenerator.globalExprIdsByExpr.get(expr);
        if (existing !== undefined)
        {
            if (!this.usedExprIds.includes(existing))
            {
                this.usedExprIds.push(existing);
            }
            return existing;
        }
        const id = CodeGenerator.globalExprs.length;
        CodeGenerator.globalExprs.push(expr);
        CodeGenerator.globalExprIdsByExpr.set(expr, id);
        this.usedExprIds.push(id);
        return id;
    }

    private internHandler(expr: string): number
    {
        const existing = CodeGenerator.globalHandlerIdsByExpr.get(expr);
        if (existing !== undefined)
        {
            if (!this.usedHandlerIds.includes(existing))
            {
                this.usedHandlerIds.push(existing);
            }
            return existing;
        }
        const id = CodeGenerator.globalHandlers.length;
        CodeGenerator.globalHandlers.push(expr);
        CodeGenerator.globalHandlerIdsByExpr.set(expr, id);
        this.usedHandlerIds.push(id);
        return id;
    }

    private renderInterpolationToParent(node: InterpolationNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: TextMarkerConfig = {
            type: 'text',
            exprId: this.internExpression(node.expression),
            deps: node.deps,
            pipes: node.pipes?.map(pipe => ({
                name: pipe.name,
                argExprIds: pipe.args.map(arg => this.internExpression(arg))
            }))
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:text:${id}`);
        Parse5Helpers.appendComment(parent, `/fluff:text:${id}`);
    }

    private renderCommentToParent(node: CommentNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        Parse5Helpers.appendComment(parent, node.content);
    }

    private renderIfToParent(node: IfNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: IfMarkerConfig = {
            type: 'if',
            branches: node.branches.map(b => ({
                exprId: b.condition ? this.internExpression(b.condition) : undefined,
                deps: b.conditionDeps
            }))
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:if:${id}`);

        for (let i = 0; i < node.branches.length; i++)
        {
            const branch = node.branches[i];
            const templateId = `${this.componentSelector}-${id}-${i}`;
            const tpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-branch', value: templateId }]);
            this.renderNodesToParent(branch.children, Parse5Helpers.getTemplateContent(tpl));
            this.collectedTemplates.push(tpl);
        }

        Parse5Helpers.appendComment(parent, `/fluff:if:${id}`);
    }

    private renderForToParent(node: ForNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: ForMarkerConfig = {
            type: 'for',
            iterator: node.iterator,
            iterableExprId: this.internExpression(node.iterable),
            deps: node.iterableDeps,
            trackBy: node.trackBy,
            hasEmpty: !!node.emptyContent
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:for:${id}`);

        const templateId = `${this.componentSelector}-${id}`;
        const tpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-tpl', value: templateId }]);
        this.renderNodesToParent(node.children, Parse5Helpers.getTemplateContent(tpl));
        this.collectedTemplates.push(tpl);

        if (node.emptyContent)
        {
            const emptyTpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-empty', value: templateId }]);
            this.renderNodesToParent(node.emptyContent, Parse5Helpers.getTemplateContent(emptyTpl));
            this.collectedTemplates.push(emptyTpl);
        }

        Parse5Helpers.appendComment(parent, `/fluff:for:${id}`);
    }

    private renderSwitchToParent(node: SwitchNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: SwitchMarkerConfig = {
            type: 'switch',
            expressionExprId: this.internExpression(node.expression),
            deps: node.expressionDeps,
            cases: node.cases.map(c => ({
                valueExprId: c.valueExpression ? this.internExpression(c.valueExpression) : undefined,
                isDefault: c.isDefault,
                fallthrough: c.fallthrough
            }))
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:switch:${id}`);

        for (let i = 0; i < node.cases.length; i++)
        {
            const caseNode = node.cases[i];
            const templateId = `${this.componentSelector}-${id}-${i}`;
            const tpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-case', value: templateId }]);
            this.renderNodesToParent(caseNode.children, Parse5Helpers.getTemplateContent(tpl));
            this.collectedTemplates.push(tpl);
        }

        Parse5Helpers.appendComment(parent, `/fluff:switch:${id}`);
    }

    private renderBreakToParent(parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: BreakMarkerConfig = {
            type: 'break'
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:break:${id}`);
    }

}

