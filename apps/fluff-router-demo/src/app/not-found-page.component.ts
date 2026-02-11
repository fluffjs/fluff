import { Component } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'not-found-page',
    templateUrl: './not-found-page.component.html',
    styleUrl: './not-found-page.component.css'
})
export class NotFoundPageComponent extends HTMLElement
{
    @Router({
        path: '**'
    })
    public router!: FluffRouter;
}
