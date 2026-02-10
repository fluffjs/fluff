import { Directive, HostElement, HostListener, Output, Publisher } from '@fluffjs/fluff';

@Directive({
    selector: '[clickOutside]'
})
export class ClickOutsideDirective extends HTMLElement
{
    @HostElement() public host: HTMLElement | null = null;

    @Output() public readonly clickOutside = new Publisher<void>();

    @HostListener('document:click')
    public onDocumentClick(event: MouseEvent): void
    {
        const path = event.composedPath();
        if (this.host && !path.includes(this.host))
        {
            this.clickOutside.emit();
        }
    }
}
