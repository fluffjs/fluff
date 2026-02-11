import type { OnInit, Subscription } from '@fluffjs/fluff';
import { Component, Reactive } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'user-page',
    templateUrl: './user-page.component.html',
    styleUrl: './user-page.component.css'
})
export class UserPageComponent extends HTMLElement implements OnInit
{
    @Router({
        path: '/users/:id'
    })
    public router!: FluffRouter;

    @Reactive()
    public userId = '';
    @Reactive()
    public tab = '';
    @Reactive()
    public fragment = '';

    private readonly subscriptions: Subscription[] = [];

    public onInit(): void
    {
        this.userId = this.router.params.get('id') ?? '';
        this.tab = this.router.queryParams.get('tab') ?? '';
        this.fragment = this.router.fragment ?? '';

        this.subscriptions.push(
            this.router.onParamsChanged((params) =>
            {
                this.userId = params.get('id') ?? '';
            }),
            this.router.onQueryParamsChanged((queryParams) =>
            {
                this.tab = queryParams.get('tab') ?? '';
            }),
            this.router.onFragmentChanged((fragment) =>
            {
                this.fragment = fragment ?? '';
            })
        );
    }

    public disconnectedCallback(): void
    {
        for (const sub of this.subscriptions)
        {
            sub.unsubscribe();
        }
    }
}
