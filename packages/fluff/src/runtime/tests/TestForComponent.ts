import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestForComponent extends FluffElement
{
    public items: string[] = ['a', 'b', 'c'];

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-for-component-0">
                        <test-for-child data-lid="l0"></test-for-child>
                    </template>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('item', 'items');
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
