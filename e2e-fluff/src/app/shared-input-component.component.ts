import { Component, Input, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'shared-input-component',
    template: `
        <div id="shared-input-component-value">component:{{ value }}</div>
    `
})
export class SharedInputComponentComponent extends HTMLElement
{
    @Input() @Reactive() public value: string = '';
}
