import type { Subscription } from '@fluffjs/fluff';
import { Component, Reactive } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'project-overview',
    templateUrl: './project-overview.component.html',
    styleUrl: './project-overview.component.css'
})
export class ProjectOverviewComponent extends HTMLElement
{
    @Router({
        path: '/projects/:projectId/overview',
        pathMatch: 'full'
    })
    public router!: FluffRouter;

    @Reactive()
    public projectId = '';

    private readonly subscriptions: Subscription[] = [];

    public onInit(): void
    {
        this.projectId = this.router.params.get('projectId') ?? '';

        this.subscriptions.push(
            this.router.onParamsChanged((params) =>
            {
                this.projectId = params.get('projectId') ?? '';
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
