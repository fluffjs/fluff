import { Directive, HostListener, Output, Publisher } from '@fluffjs/fluff';

@Directive({
    selector: '[sharedOutputB]'
})
export class SharedOutputBDirective extends HTMLElement
{
    @Output() public readonly notify = new Publisher<string>();

    @HostListener('dblclick')
    public onDoubleClick(): void
    {
        this.notify.emit('from-directive-b');
    }
}
