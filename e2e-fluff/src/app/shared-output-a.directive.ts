import { Directive, HostListener, Output, Publisher } from '@fluffjs/fluff';

@Directive({
    selector: '[sharedOutputA]'
})
export class SharedOutputADirective extends HTMLElement
{
    @Output() public readonly notify = new Publisher<string>();

    @HostListener('click')
    public onClick(): void
    {
        this.notify.emit('from-directive-a');
    }
}
