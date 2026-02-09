import { Component, Input } from '@fluffjs/fluff';

@Component({
    selector: 'native-property-child',
    template: `<input id="native-property-input" [disabled]="!enabled" />`
})
export class NativePropertyChildComponent extends HTMLElement
{
    @Input()
    public enabled: boolean = false;
}
