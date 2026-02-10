import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestUnsubscribeNestedParentBaseComponent } from './TestUnsubscribeNestedParentBaseComponent.js';

export class TestForUnsubscribeNestedParentComponent extends TestUnsubscribeNestedParentBaseComponent
{
    private readonly __items = new Property<number[]>({ initialValue: [0], propertyName: 'items' });

    public get items(): number[]
    {
        return this.__items.getValue() ?? [];
    }

    public set items(value: number[])
    {
        this.__items.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-for-unsubscribe-nested-parent-0">
                        <test-unsubscribe-nested-child x-fluff-component data-lid="l0"></test-unsubscribe-nested-child>
                    </template>
                    <template data-fluff-empty="test-for-unsubscribe-nested-parent-0">
                        <div class="empty">empty</div>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('item', 'items');
        this.__setMarkerConfigs([
            [0, [1, si, 0, true, [si + 1], null]]
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
