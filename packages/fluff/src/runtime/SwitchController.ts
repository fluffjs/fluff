import type { RenderContext } from '../interfaces/RenderContext.js';
import { FluffBase, type CompactSwitchConfig } from './FluffBase.js';
import { MarkerController } from './MarkerController.js';

export class SwitchController extends MarkerController<CompactSwitchConfig>
{
    private templates: HTMLTemplateElement[] = [];

    public initialize(): void
    {
        const hostTag = this.host.tagName.toLowerCase();
        const templateIdPrefix = `${hostTag}-${this.id}-`;
        this.templates = Array.from(this.shadowRoot.querySelectorAll<HTMLTemplateElement>(`template[data-fluff-case^="${templateIdPrefix}"]`));

        // CompactSwitchConfig: [3, exprId, deps, cases[]]  —  case = [isDefault, fallthrough, valueExprId]
        const [, expressionExprId, compactDeps, cases] = this.config;
        const deps = FluffBase.__decodeDeps(compactDeps) ?? [];

        const update = (): void =>
        {
            this.clearContentBetweenMarkersWithCleanup(this.bindingsSubscriptions);

            const switchValue = this.evaluateExpr(expressionExprId);
            let matched = false;
            let shouldFallthrough = false;

            const renderContext: RenderContext = {
                shouldBreak: false
            };

            for (let i = 0; i < cases.length; i++)
            {
                if (renderContext.shouldBreak) break;

                const [isDefault, fallthrough, valueExprId] = cases[i];
                const template = this.templates[i];
                if (!template) continue;

                const caseMatches = isDefault
                    || (valueExprId !== null && this.evaluateExpr(valueExprId) === switchValue);

                if (shouldFallthrough || (!matched && caseMatches))
                {
                    matched = true;
                    this.cloneAndInsertTemplate(template, this.loopContext, renderContext, this.bindingsSubscriptions);
                    shouldFallthrough = fallthrough;
                }
            }

            this.refreshParentBindings();
        };

        this.subscribeAndRun(deps, update);
    }
}
