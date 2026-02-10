import { Directive, Input, Reactive } from '@fluffjs/fluff';

@Directive({
    selector: '[sharedInputB]'
})
export class SharedInputBDirective extends HTMLElement
{
    @Input() @Reactive() public value: string = '';

    public getReceivedValue(): string
    {
        return `B:${this.value}`;
    }
}
