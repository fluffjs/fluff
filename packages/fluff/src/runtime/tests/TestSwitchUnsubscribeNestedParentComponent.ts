import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestUnsubscribeNestedParentBaseComponent } from './TestUnsubscribeNestedParentBaseComponent.js';

export class TestSwitchUnsubscribeNestedParentComponent extends TestUnsubscribeNestedParentBaseComponent
{
    private readonly __mode = new Property<string>({ initialValue: 'a', propertyName: 'mode' });

    public get mode(): string
    {
        return this.__mode.getValue() ?? 'a';
    }

    public set mode(value: string)
    {
        this.__mode.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:switch:0-->
                    <!--/fluff:switch:0-->
                    <template data-fluff-case="test-switch-unsubscribe-nested-parent-0-0">
                        <test-unsubscribe-nested-child x-fluff-component data-lid="l0"></test-unsubscribe-nested-child>
                    </template>
                    <template data-fluff-case="test-switch-unsubscribe-nested-parent-0-1">
                        <div class="placeholder">placeholder</div>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('mode');
        this.__setMarkerConfigs([
            [0, [3, 0, [si], [[false, false, 1], [false, false, 2]]]]
        ]);

        const bi = FluffBase.__s.length;
        FluffBase.__s.push('stats');
        const bindings = {
            l0: [[bi, 0, [bi], 3]]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
