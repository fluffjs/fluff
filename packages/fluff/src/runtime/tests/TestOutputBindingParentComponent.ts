import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestOutputBindingParentComponent extends FluffElement
{
    private readonly __show = new Property<boolean>({ initialValue: true, propertyName: 'show' });

    public editCount = 0;
    public lastTaskId: number | null = null;

    public get show(): boolean
    {
        return this.__show.getValue() ?? false;
    }

    public set show(value: boolean)
    {
        this.__show.setValue(value);
    }

    public onChildEdit(event: { taskId: number }): void
    {
        this.editCount++;
        this.lastTaskId = event?.taskId ?? null;
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-output-binding-parent-0-0">
                        <test-output-binding-child x-fluff-component data-lid="l0"></test-output-binding-child>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('show');
        this.__setMarkerConfigs([
            [0, [0, [[0, [si]]]]]
        ]);

        const bi = FluffBase.__s.length;
        FluffBase.__s.push('edit');
        const bindings = {
            l0: [[bi, 1, null, 0]]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
