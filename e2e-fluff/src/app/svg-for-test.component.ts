import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'svg-for-test',
    template: `
        <svg id="test-svg" width="200" height="200" viewBox="0 0 200 200">
            <rect id="static-rect" x="10" y="10" width="50" height="50" fill="blue"></rect>
            @for (item of items) {
                <rect id="for-rect-{{ $index }}" x="{{ 70 + $index * 30 }}" y="10" width="20" height="20" fill="green"></rect>
            }
        </svg>
    `
})
export class SvgForTestComponent extends HTMLElement
{
    @Reactive() public items = [1, 2, 3];
}
