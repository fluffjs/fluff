import { Component } from '@fluffjs/fluff';
import { NativePropertyHolder } from './native-property-holder.js';

@Component({
    selector: 'native-property-parent',
    template: `
        <div>
            <button id="native-property-toggle" (click)="toggle()">Toggle Enabled</button>
            <native-property-child [enabled]="holder.enabled"></native-property-child>
        </div>
    `
})
export class NativePropertyParentComponent extends HTMLElement
{
    public readonly holder = new NativePropertyHolder();

    public toggle(): void
    {
        this.holder.enabled.setValue(!this.holder.enabled.getValue());
    }
}
