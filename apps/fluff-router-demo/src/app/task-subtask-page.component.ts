import type { Subscription } from '@fluffjs/fluff';
import { Component, Reactive } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'task-subtask-page',
    templateUrl: './task-subtask-page.component.html',
    styleUrl: './task-subtask-page.component.css'
})
export class TaskSubtaskPageComponent extends HTMLElement
{
    @Router({
        path: '/projects/:projectId/tasks/:taskId/subtasks/:subtaskId',
        pathMatch: 'full'
    })
    public router!: FluffRouter;

    @Reactive()
    public projectId = '';

    @Reactive()
    public taskId = '';

    @Reactive()
    public subtaskId = '';

    private readonly subscriptions: Subscription[] = [];

    public onInit(): void
    {
        this.projectId = this.router.params.get('projectId') ?? '';
        this.taskId = this.router.params.get('taskId') ?? '';
        this.subtaskId = this.router.params.get('subtaskId') ?? '';

        this.subscriptions.push(
            this.router.onParamsChanged((params) =>
            {
                this.projectId = params.get('projectId') ?? '';
                this.taskId = params.get('taskId') ?? '';
                this.subtaskId = params.get('subtaskId') ?? '';
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
