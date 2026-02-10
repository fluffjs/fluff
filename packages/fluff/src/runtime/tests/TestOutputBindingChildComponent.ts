import { Publisher } from '../../utils/Publisher.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestOutputBindingChildComponent extends FluffElement
{
    public edit = new Publisher<{ taskId: number }>();

    public onEdit(): void
    {
        this.edit.emit({ taskId: 42 });
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<button data-lid="l0">Edit</button>';

        const bi = FluffBase.__s.length;
        FluffBase.__s.push('click');
        const bindings = {
            l0: [[bi, 1, null, 1]]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
