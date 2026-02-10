import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export interface TestLateDefineForColumn
{
    readonly id: string;
}

export class TestLateDefineForComponent extends FluffElement
{
    public columns: TestLateDefineForColumn[] = [
        { id: 'todo' },
        { id: 'doing' },
        { id: 'done' }
    ];

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="late-define-for-component-0">
                        <late-define-for-child x-fluff-component="" data-lid="l0"></late-define-for-child>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('column', 'columns');
        this.__setMarkerConfigs([
            [0, [1, si, 0, false, [si + 1], null]]
        ]);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
