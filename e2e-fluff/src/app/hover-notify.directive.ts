import { Directive, HostListener, Output, Publisher } from '@fluffjs/fluff';

@Directive({
    selector: '[hoverNotify]'
})
export class HoverNotifyDirective extends HTMLElement
{
    @Output() public readonly hovered = new Publisher<boolean>();

    @HostListener('mouseenter')
    public onMouseEnter(): void
    {
        this.hovered.emit(true);
    }

    @HostListener('mouseleave')
    public onMouseLeave(): void
    {
        this.hovered.emit(false);
    }
}
