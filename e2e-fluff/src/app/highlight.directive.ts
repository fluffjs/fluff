import { Directive, HostBinding, Input } from '@fluffjs/fluff';

@Directive({
    selector: '[highlight]'
})
export class HighlightDirective extends HTMLElement
{
    @Input() public highlight: string = 'yellow';

    @HostBinding('style.backgroundColor')
    public get backgroundColor(): string
    {
        return this.highlight;
    }
}
