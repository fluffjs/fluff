import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestUnsubscribeNestedParentBaseComponent } from './TestUnsubscribeNestedParentBaseComponent.js';

export class TestIfUnsubscribeNestedParentComponent extends TestUnsubscribeNestedParentBaseComponent
{
    private readonly __show = new Property<boolean>({ initialValue: true, propertyName: 'show' });

    public get show(): boolean
    {
        return this.__show.getValue() ?? false;
    }

    public set show(value: boolean)
    {
        this.__show.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-if-unsubscribe-nested-parent-0-0">
                        <test-unsubscribe-nested-child x-fluff-component data-lid="l0"></test-unsubscribe-nested-child>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('show');
        this.__setMarkerConfigs([
            [0, [0, [[0, [si]]]]]
        ]);

        const bi = FluffBase.__s.length;
        FluffBase.__s.push('stats');
        const bindings = {
            l0: [[bi, 0, [bi], 1]]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
