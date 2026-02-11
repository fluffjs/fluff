import type { OnInit } from '@fluffjs/fluff';
import { Component, Reactive } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'event-params-page',
    templateUrl: './event-params-page.component.html',
    styleUrl: './event-params-page.component.css'
})
export class EventParamsPageComponent extends HTMLElement implements OnInit
{
    @Router({
        path: '/event-params/:id'
    })
    public router!: FluffRouter;

    @Reactive()
    public injectedParamId = '';

    @Reactive()
    public eventParamId = '';

    public onInit(): void
    {
        this.injectedParamId = this.router.params.get('id') ?? '(empty)';

        this.router.onRouteChanged((event) =>
        {
            this.eventParamId = event.params.get('id') ?? '(empty)';
        });
    }
}
