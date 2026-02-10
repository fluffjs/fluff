import { Directive, HostBinding, Input, Reactive } from '@fluffjs/fluff';

@Directive({
    selector: '[toggleClass]'
})
export class ToggleClassDirective extends HTMLElement
{
    @Input() @Reactive() public toggleClass: boolean = false;

    @HostBinding('class.directive-active')
    public get isActive(): boolean
    {
        return this.toggleClass;
    }
}
