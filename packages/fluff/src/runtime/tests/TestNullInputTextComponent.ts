import { Property as PropertyImpl } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export interface TestTask
{
    title: string;
}

export class TestNullInputTextComponent extends FluffElement
{
    private readonly __isEditing = new PropertyImpl<boolean>(false);
    private readonly __task = new PropertyImpl<TestTask | null>(null);

    public get isEditing(): boolean
    {
        return this.__isEditing.getValue() ?? false;
    }

    public set isEditing(value: boolean)
    {
        this.__isEditing.setValue(value);
    }

    public get task(): TestTask | null
    {
        return this.__task.getValue() ?? null;
    }

    public set task(value: TestTask | null)
    {
        this.__task.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-null-input-text-0-0">
                        <div class="title"><!--fluff:text:1--><!--/fluff:text:1--></div>
                    </template>
                    <template data-fluff-branch="test-null-input-text-0-1"></template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('isEditing', 'task');
        this.__setMarkerConfigs([
            [0, [0, [[0, [si]], []]]],
            [1, [2, 1, [si + 1], null]]
        ]);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
