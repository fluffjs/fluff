import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'click-outside-test',
    template: `
        <div id="click-outside-target" clickOutside (clickOutside)="onClickOutside()">
            Click outside of me
        </div>
        <div id="outside-area">Outside area</div>
        <div id="click-outside-count">{{ clickCount }}</div>
    `
})
export class ClickOutsideTestComponent extends HTMLElement
{
    @Reactive() public clickCount = 0;

    public onClickOutside(): void
    {
        this.clickCount++;
    }
}
