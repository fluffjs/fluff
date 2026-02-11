import { Component } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'about-page',
    templateUrl: './about-page.component.html',
    styleUrl: './about-page.component.css'
})
export class AboutPageComponent extends HTMLElement
{
    @Router({
        path: '/about',
        pathMatch: 'full'
    })
    public router!: FluffRouter;
}
