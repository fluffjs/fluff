import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestInterpolationNestedPropertyContainerClass } from './TestInterpolationNestedPropertyContainerClass.js';

export abstract class TestInterpolationNestedPropertyComponentBase extends FluffElement
{
    public __hostClass = new Property<TestInterpolationNestedPropertyContainerClass>({
        initialValue: new TestInterpolationNestedPropertyContainerClass(),
        propertyName: 'hostClass'
    });

    public get hostClass(): TestInterpolationNestedPropertyContainerClass
    {
        const val = this.__hostClass.getValue();
        if (!val)
        {
            throw new Error('hostClass is null');
        }
        return val;
    }

    public set hostClass(val: TestInterpolationNestedPropertyContainerClass)
    {
        this.__hostClass.setValue(val);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<!--fluff:text:0--><!--/fluff:text:0-->';

        const si = FluffBase.__s.length;
        FluffBase.__s.push('hostClass', 'childProp');
        this.__setMarkerConfigs([
            [0, [2, 0, [[si, si + 1]], null]]
        ]);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
