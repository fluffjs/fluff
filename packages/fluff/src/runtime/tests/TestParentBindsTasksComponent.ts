import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestParentBindsTasksComponent extends FluffElement
{
    public tasksForChild: number[] = [1, 2, 3];
    public childList: number[] = [0];

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-parent-binds-tasks-0">
                        <test-child-tasks-list x-fluff-component="" data-lid="l0"></test-child-tasks-list>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('child', 'childList');
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
