import type { PropertyChain } from '../interfaces/PropertyChain.js';
import { FluffBase, type CompactIfConfig } from './FluffBase.js';
import { MarkerController } from './MarkerController.js';

export class IfController extends MarkerController<CompactIfConfig>
{
    private templates: HTMLTemplateElement[] = [];
    private currentBranchIndex = -1;

    public initialize(): void
    {
        const hostTag = this.host.tagName.toLowerCase();
        const templateIdPrefix = `${hostTag}-${this.id}-`;
        this.templates = Array.from(this.shadowRoot.querySelectorAll<HTMLTemplateElement>(`template[data-fluff-branch^="${templateIdPrefix}"]`));

        // CompactIfConfig: [0, branches[]]  —  branch = [exprId?, deps?] or [] for else
        const [, branches] = this.config;

        const allDeps: PropertyChain[] = [];
        for (const branch of branches)
        {
            if (branch.length > 1 && branch[1])
            {
                const decoded = FluffBase.__decodeDeps(branch[1]);
                if (decoded) allDeps.push(...decoded);
            }
        }

        const update = (): void =>
        {
            let matchedIndex = -1;

            for (let i = 0; i < branches.length; i++)
            {
                const branch = branches[i];
                if (branch.length === 0 || branch[0] === null)
                {
                    matchedIndex = i;
                    break;
                }
                const result = this.evaluateExpr(branch[0]);
                if (result)
                {
                    matchedIndex = i;
                    break;
                }
            }

            if (matchedIndex !== this.currentBranchIndex)
            {
                this.clearContentBetweenMarkersWithCleanup(this.bindingsSubscriptions);
                this.currentBranchIndex = matchedIndex;

                if (matchedIndex >= 0 && matchedIndex < this.templates.length)
                {
                    this.cloneAndInsertTemplate(this.templates[matchedIndex], this.loopContext, undefined, this.bindingsSubscriptions);
                }

                this.refreshParentBindings();
            }
        };

        this.subscribeAndRun(allDeps, update);
    }
}
