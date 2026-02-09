import { Component, Reactive } from '@fluffjs/fluff';

interface RectItem
{
    id: number;
    color: string;
}

@Component({
    selector: 'svg-for-test',
    template: `
        <svg id="test-svg" width="200" height="200" viewBox="0 0 200 200">
            <rect id="static-rect" x="10" y="10" width="50" height="50" fill="blue"></rect>
            @for (item of items; track item.id) {
                <rect class="for-rect" x="{{ 70 + $index * 30 }}" y="10" width="20" height="20" [fill]="item.color"></rect>
            }
        </svg>
    `
})
export class SvgForTestComponent extends HTMLElement
{
    @Reactive() public items: RectItem[] = [
        { id: 1, color: 'red' },
        { id: 2, color: 'green' },
        { id: 3, color: 'purple' }
    ];
}
