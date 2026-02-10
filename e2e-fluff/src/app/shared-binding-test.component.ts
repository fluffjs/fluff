import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'shared-binding-test',
    template: `
        <div id="shared-input-source">{{ inputValue }}</div>
        <button id="change-input-btn" (click)="changeInput()">Change Input</button>
        
        <!-- Component with same @Input as two directives -->
        <shared-input-component 
            id="shared-input-target"
            sharedInputA 
            sharedInputB 
            [value]="inputValue">
        </shared-input-component>
        
        <!-- Component with same @Output as two directives - any emit should trigger handler -->
        <shared-output-component 
            id="shared-output-target"
            sharedOutputA 
            sharedOutputB 
            (notify)="onNotify($event)">
        </shared-output-component>
        
        <div id="notify-log">{{ notifyLog }}</div>
    `
})
export class SharedBindingTestComponent extends HTMLElement
{
    @Reactive() public inputValue = 'initial';
    @Reactive() public notifyLog = '';

    public changeInput(): void
    {
        this.inputValue = 'updated';
    }

    public onNotify(source: string): void
    {
        this.notifyLog = this.notifyLog ? `${this.notifyLog},${source}` : source;
    }
}
