import { Directive, Input, Reactive } from '@fluffjs/fluff';

@Directive({
    selector: '[sharedInputA]'
})
export class SharedInputADirective extends HTMLElement
{
    @Input() @Reactive() public value: string = '';

    public getReceivedValue(): string
    {
        return `A:${this.value}`;
    }
}
