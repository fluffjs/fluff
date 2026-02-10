import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';

interface ParentComponentInstance extends FluffElement
{
    sourceProperty: Property<number>;
}

type ParentComponentConstructor = new () => ParentComponentInstance;

export function createPropBindParentComponent(childTag: string): ParentComponentConstructor
{
    class ParentComponent extends FluffElement
    {
        public sourceProperty = new Property<number>({ initialValue: 2, propertyName: 'sourceProperty' });

        protected override __render(): void
        {
            this.__getShadowRoot().innerHTML = `
                <${childTag} x-fluff-component data-lid="l0"></${childTag}>
            `;
        }

        protected override __setupBindings(): void
        {
            super.__setupBindings();
        }
    }

    const bi = FluffBase.__s.length;
    FluffBase.__s.push('theProp');
    ParentComponent.__bindings = {
        l0: [[bi, 0, null, 0]]
    };

    return ParentComponent as ParentComponentConstructor;
}
