import { Component } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';
import { DenyGuard } from './deny-guard.js';

@Component({
    selector: 'guarded-page',
    templateUrl: './guarded-page.component.html',
    styleUrl: './guarded-page.component.css'
})
export class GuardedPageComponent extends HTMLElement
{
    @Router({
        path: '/guarded',
        guard: [DenyGuard]
    })
    public router!: FluffRouter;
}
