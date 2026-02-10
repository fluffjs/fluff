import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestChildTasksListComponent extends FluffElement
{
    private readonly __tasks = new Property<number[]>([]);

    public get tasks(): number[]
    {
        return this.__tasks.getValue() ?? [];
    }

    public set tasks(value: number[])
    {
        this.__tasks.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-child-tasks-list-0">
                        <div class="item"></div>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('task', 'tasks');
        this.__setMarkerConfigs([
            [0, [1, si, 2, false, [si + 1], null]]
        ]);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
