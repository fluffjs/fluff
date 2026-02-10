import { Component, HostListener, Output, Publisher } from '@fluffjs/fluff';

@Component({
    selector: 'shared-output-component',
    template: `
        <div id="shared-output-component-inner">Component inner content</div>
    `
})
export class SharedOutputComponentComponent extends HTMLElement
{
    @Output() public readonly notify = new Publisher<string>();

    @HostListener('contextmenu')
    public onContextMenu(): void
    {
        this.notify.emit('from-component');
    }
}
