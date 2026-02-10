import type { RenderContext } from '../interfaces/RenderContext.js';
import { FluffBase, type CompactForConfig } from './FluffBase.js';
import { MarkerController } from './MarkerController.js';

export class ForController extends MarkerController<CompactForConfig>
{
    private itemTemplate: HTMLTemplateElement | null = null;
    private emptyTemplate: HTMLTemplateElement | null = null;

    public initialize(): void
    {
        const hostTag = this.host.tagName.toLowerCase();
        const templateId = `${hostTag}-${this.id}`;
        this.itemTemplate = this.shadowRoot.querySelector<HTMLTemplateElement>(`template[data-fluff-tpl="${templateId}"]`);
        this.emptyTemplate = this.shadowRoot.querySelector<HTMLTemplateElement>(`template[data-fluff-empty="${templateId}"]`);

        // CompactForConfig: [1, iteratorNameIdx, iterableExprId, hasEmpty, deps, trackByNameIdx]
        const [, iteratorIdx, iterableExprId, , compactDeps] = this.config;
        const iterator = FluffBase.__s[iteratorIdx];
        const deps = FluffBase.__decodeDeps(compactDeps) ?? [];

        const update = (): void =>
        {
            this.clearContentBetweenMarkersWithCleanup(this.bindingsSubscriptions);

            const items = this.evaluateExpr(iterableExprId);
            if (!Array.isArray(items) || items.length === 0)
            {
                if (this.emptyTemplate)
                {
                    this.cloneAndInsertTemplate(this.emptyTemplate, this.loopContext, undefined, this.bindingsSubscriptions);
                }
                return;
            }

            if (!this.itemTemplate) return;

            const renderContext: RenderContext = {
                shouldBreak: false
            };

            for (let i = 0; i < items.length; i++)
            {
                if (renderContext.shouldBreak) break;

                const itemContext = {
                    ...this.loopContext, [iterator]: items[i], $index: i
                };

                this.cloneAndInsertTemplate(this.itemTemplate, itemContext, renderContext, this.bindingsSubscriptions);
            }

            this.refreshParentBindings();
        };

        this.subscribeAndRun(deps, update);
    }
}
