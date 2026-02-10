import { Directive, HostListener, Output, Publisher } from '@fluffjs/fluff';

@Directive({
    selector: '[clickCounter]'
})
export class ClickCounterDirective extends HTMLElement
{
    private count = 0;

    @Output() public readonly countChanged = new Publisher<number>();

    @HostListener('click')
    public onClick(): void
    {
        this.count++;
        this.countChanged.emit(this.count);
    }
}
