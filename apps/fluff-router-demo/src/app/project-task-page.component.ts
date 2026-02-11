import type { Subscription } from '@fluffjs/fluff';
import { Component, Reactive } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';
import { TaskSubtaskPageComponent } from './task-subtask-page.component.js';

@Component({
    selector: 'project-task-page',
    templateUrl: './project-task-page.component.html',
    styleUrl: './project-task-page.component.css'
})
export class ProjectTaskPageComponent extends HTMLElement
{
    @Router({
        path: '/projects/:projectId/tasks/:taskId',
        children: [TaskSubtaskPageComponent]
    })
    public router!: FluffRouter;

    @Reactive()
    public projectId = '';

    @Reactive()
    public taskId = '';

    private readonly subscriptions: Subscription[] = [];

    public onInit(): void
    {
        this.projectId = this.router.params.get('projectId') ?? '';
        this.taskId = this.router.params.get('taskId') ?? '';

        this.subscriptions.push(
            this.router.onParamsChanged((params) =>
            {
                this.projectId = params.get('projectId') ?? '';
                this.taskId = params.get('taskId') ?? '';
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
