import { FluffBase, type CompactTextConfig } from './FluffBase.js';
import { MarkerController } from './MarkerController.js';

export class TextController extends MarkerController<CompactTextConfig>
{
    private textNode: Text | null = null;

    public initialize(): void
    {
        this.textNode = document.createTextNode('');
        this.insertBeforeEndMarker(this.textNode);

        // CompactTextConfig: [2, exprId, deps, pipes]  —  pipes = [pipeNameIdx, argExprIds[]][]
        const [, exprId, compactDeps, compactPipes] = this.config;
        const deps = FluffBase.__decodeDeps(compactDeps) ?? [];
        const pipes = compactPipes ?? [];

        const update = (): void =>
        {
            let result = this.evaluateExpr(exprId);

            if (this.host.__applyPipesForController)
            {
                const scope = this.getScope();
                const allLocals = this.collectLocalsFromScope(scope);
                result = this.host.__applyPipesForController(result, pipes, allLocals);
            }

            if (this.textNode)
            {
                this.textNode.textContent = this.formatValue(result);
            }
        };

        this.subscribeAndRun(deps, update);
    }

    private formatValue(result: unknown): string
    {
        if (result === null || result === undefined)
        {
            return '';
        }
        if (typeof result === 'object')
        {
            return JSON.stringify(result);
        }
        if (typeof result === 'string')
        {
            return result;
        }
        if (typeof result === 'number' || typeof result === 'boolean')
        {
            return String(result);
        }
        return '';
    }
}
