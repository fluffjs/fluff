import { Component } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'home-page',
    templateUrl: './home-page.component.html',
    styleUrl: './home-page.component.css'
})
export class HomePageComponent extends HTMLElement
{
    @Router({
        path: '/',
        pathMatch: 'full'
    })
    public router!: FluffRouter;

    public aboutRoute = '/about';
}
