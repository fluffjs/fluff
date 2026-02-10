import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'directive-test',
    template: `
        <div id="highlight-target" highlight>Default yellow highlight</div>
        <div id="highlight-custom" [highlight]="'lime'">Custom lime highlight</div>
        
        <div id="click-counter-target" clickCounter (countChanged)="onCountChanged($event)">Click me</div>
        <div id="click-count">{{ clickCount }}</div>
        
        <div id="toggle-target" [toggleClass]="isToggled">Toggle target</div>
        <button id="toggle-directive-btn" (click)="toggle()">Toggle</button>
        
        <div id="hover-target" hoverNotify (hovered)="onHover($event)">Hover over me</div>
        <div id="hover-status">{{ hoverText }}</div>
    `
})
export class DirectiveTestComponent extends HTMLElement
{
    @Reactive() public clickCount = 0;
    @Reactive() public isToggled = false;
    @Reactive() public hoverText = 'not hovered';

    public onCountChanged(count: number): void
    {
        this.clickCount = count;
    }

    public toggle(): void
    {
        this.isToggled = !this.isToggled;
    }

    public onHover(isHovered: boolean): void
    {
        this.hoverText = isHovered ? 'hovered' : 'not hovered';
    }
}
