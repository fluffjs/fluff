import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';

export interface DirectiveMetadata
{
    selector: string;
    className: string;
}

interface BabelPluginDirectiveState
{
    filename?: string;
}

export const directiveMetadataMap = new Map<string, DirectiveMetadata>();

function getDecoratorName(decorator: t.Decorator): string | null
{
    if (t.isCallExpression(decorator.expression) && t.isIdentifier(decorator.expression.callee))
    {
        return decorator.expression.callee.name;
    }
    if (t.isIdentifier(decorator.expression))
    {
        return decorator.expression.name;
    }
    return null;
}

export default function directivePlugin(): PluginObj<BabelPluginDirectiveState>
{
    return {
        name: 'babel-plugin-directive', visitor: {
            ClassDeclaration(path: NodePath<t.ClassDeclaration>, state): void
            {
                const decorators = path.node.decorators ?? [];

                const directiveDecorator = decorators.find(dec =>
                {
                    if (t.isCallExpression(dec.expression))
                    {
                        const { callee } = dec.expression;
                        return t.isIdentifier(callee) && callee.name === 'Directive';
                    }
                    return false;
                });

                if (!directiveDecorator) return;
                if (!t.isCallExpression(directiveDecorator.expression)) return;

                const args = directiveDecorator.expression.arguments;
                if (args.length === 0) return;

                const [configArg] = args;
                if (!t.isObjectExpression(configArg)) return;

                const metadata: Partial<DirectiveMetadata> = {};

                if (path.node.id)
                {
                    metadata.className = path.node.id.name;
                }

                for (const prop of configArg.properties)
                {
                    if (!t.isObjectProperty(prop)) continue;
                    if (!t.isIdentifier(prop.key)) continue;

                    const key = prop.key.name;
                    const { value } = prop;

                    if (key === 'selector' && t.isStringLiteral(value))
                    {
                        metadata.selector = value.value;
                    }
                }

                const filename = state.filename ?? 'unknown';
                if (metadata.selector && metadata.className)
                {
                    directiveMetadataMap.set(filename, {
                        selector: metadata.selector,
                        className: metadata.className
                    });
                }

                const hostElementProps: string[] = [];
                const classBody = path.node.body.body;

                for (const member of classBody)
                {
                    if (!t.isClassProperty(member)) continue;
                    if (!t.isIdentifier(member.key)) continue;

                    const memberDecorators = member.decorators ?? [];
                    const hostElementDecIdx = memberDecorators.findIndex(dec => getDecoratorName(dec) === 'HostElement');

                    if (hostElementDecIdx !== -1)
                    {
                        hostElementProps.push(member.key.name);
                        memberDecorators.splice(hostElementDecIdx, 1);
                    }
                }

                if (hostElementProps.length > 0)
                {
                    const assignments = hostElementProps.map(propName =>
                        t.expressionStatement(
                            t.assignmentExpression(
                                '=',
                                t.memberExpression(t.thisExpression(), t.identifier(propName)),
                                t.identifier('hostElement')
                            )
                        )
                    );

                    const setHostElementMethod = t.classMethod(
                        'method',
                        t.identifier('__assignHostElementProps'),
                        [t.identifier('hostElement')],
                        t.blockStatement(assignments),
                        false,
                        false
                    );

                    classBody.push(setHostElementMethod);
                }
            }
        }
    };
}
