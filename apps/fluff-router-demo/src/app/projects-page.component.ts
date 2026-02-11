import { Component, Reactive } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';
import { ProjectOverviewComponent } from './project-overview.component.js';
import { ProjectTaskPageComponent } from './project-task-page.component.js';

@Component({
    selector: 'projects-page',
    templateUrl: './projects-page.component.html',
    styleUrl: './projects-page.component.css'
})
export class ProjectsPageComponent extends HTMLElement
{
    @Router({
        path: '/projects/:projectId',
        children: [ProjectOverviewComponent, ProjectTaskPageComponent]
    })
    public router!: FluffRouter;

    @Reactive()
    public projectId = '';

    public onInit(): void
    {
        this.projectId = this.router.params.get('projectId') ?? '';
    }
}
