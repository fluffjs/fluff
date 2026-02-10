import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';

export class DirectOutputParent extends FluffElement
{
    public receivedValue: string | null = null;

    public onSubmit(event: { value: string }): void
    {
        this.receivedValue = event.value;
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<direct-output-child x-fluff-component data-lid="l0"></direct-output-child>';

        const si = FluffBase.__s.length;
        FluffBase.__s.push('submit');
        const bindings = {
            l0: [[si, 1, null, 0] as const]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }
}
