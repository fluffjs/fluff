import { expect, test } from '@playwright/test';

test.describe('Fluff Router', () =>
{
    test.describe('home page', () =>
    {
        test('should load home page at /', async ({ page }) =>
        {
            await page.goto('/');
            const heading = page.locator('home-page h1');
            await expect(heading).toContainText('Home');
        });

        test('should display navigation links', async ({ page }) =>
        {
            await page.goto('/');
            const aboutLink = page.locator('home-page a[href="/about"]');
            await expect(aboutLink).toBeVisible();

            const userLink = page.locator('home-page a[href="/users/42"]');
            await expect(userLink).toBeVisible();
        });
    });

    test.describe('about page', () =>
    {
        test('should load about page at /about', async ({ page }) =>
        {
            await page.goto('/about');
            const heading = page.locator('about-page h1');
            await expect(heading).toContainText('About');
        });

        test('should have correct URL in address bar', async ({ page }) =>
        {
            await page.goto('/about');
            expect(page.url()).toContain('/about');
        });

        test('should navigate back to home via link', async ({ page }) =>
        {
            await page.goto('/about');
            await page.locator('about-page a[href="/"]').click();
            await expect(page.locator('home-page h1')).toContainText('Home');
        });
    });

    test.describe('user page with route params', () =>
    {
        test('should display user ID from route params', async ({ page }) =>
        {
            await page.goto('/users/42');
            const userId = page.locator('user-page .info');
            await expect(userId).toContainText('42');
        });

        test('should display different user ID', async ({ page }) =>
        {
            await page.goto('/users/99');
            const userId = page.locator('user-page .info');
            await expect(userId).toContainText('99');
        });

        test('should display query params', async ({ page }) =>
        {
            await page.goto('/users/42?tab=settings');
            const info = page.locator('user-page .info');
            await expect(info).toContainText('settings');
        });

        test('should display fragment', async ({ page }) =>
        {
            await page.goto('/users/42#profile');
            const info = page.locator('user-page .info');
            await expect(info).toContainText('profile');
        });

        test('should display query params and fragment together', async ({ page }) =>
        {
            await page.goto('/users/99?tab=settings#profile');
            const info = page.locator('user-page .info');
            await expect(info).toContainText('99');
            await expect(info).toContainText('settings');
            await expect(info).toContainText('profile');
        });

        test('should have correct URL in address bar', async ({ page }) =>
        {
            await page.goto('/users/42?tab=settings#profile');
            expect(page.url()).toContain('/users/42');
            expect(page.url()).toContain('tab=settings');
            expect(page.url()).toContain('#profile');
        });
    });

    test.describe('wildcard / 404 page', () =>
    {
        test('should show 404 page for unknown routes', async ({ page }) =>
        {
            await page.goto('/nowhere');
            const heading = page.locator('not-found-page h1');
            await expect(heading).toContainText('404');
        });

        test('should show 404 for deeply nested unknown routes', async ({ page }) =>
        {
            await page.goto('/some/deep/unknown/path');
            const heading = page.locator('not-found-page h1');
            await expect(heading).toContainText('404');
        });
    });

    test.describe('lazy loading', () =>
    {
        test('should lazy load routed components as separate chunks', async ({ page }) =>
        {
            const chunkRequests: string[] = [];
            page.on('request', (request) =>
            {
                const url = request.url();
                if (url.includes('.component-'))
                {
                    chunkRequests.push(url);
                }
            });

            await page.goto('/');
            await expect(page.locator('home-page h1')).toContainText('Home');
            expect(chunkRequests.some(u => u.includes('home-page'))).toBe(true);
        });
    });

    test.describe('navigation between routes', () =>
    {
        test('should navigate from home to about via link', async ({ page }) =>
        {
            await page.goto('/');
            await expect(page.locator('home-page h1')).toContainText('Home');

            await page.locator('home-page a[href="/about"]').click();
            await expect(page.locator('about-page h1')).toContainText('About');
            expect(page.url()).toContain('/about');
        });

        test('should navigate from home to user page via link', async ({ page }) =>
        {
            await page.goto('/');
            await page.locator('home-page a[href="/users/42"]').click();
            await expect(page.locator('user-page .info')).toContainText('42');
            expect(page.url()).toContain('/users/42');
        });

        test('should navigate from home to 404 via link', async ({ page }) =>
        {
            await page.goto('/');
            await page.locator('home-page a[href="/nowhere"]').click();
            await expect(page.locator('not-found-page h1')).toContainText('404');
        });
    });

    test.describe('router outlet', () =>
    {
        test('should render router-outlet in app shell', async ({ page }) =>
        {
            await page.goto('/');
            const outlet = page.locator('router-outlet');
            await expect(outlet).toBeAttached();
        });

        test('should render routed component inside outlet', async ({ page }) =>
        {
            await page.goto('/');
            const homeInOutlet = page.locator('router-outlet home-page');
            await expect(homeInOutlet).toBeAttached();
        });
    });

    test.describe('BUG #1: route guards should block navigation', () =>
    {
        test('should NOT render guarded page when DenyGuard returns false', async ({ page }) =>
        {
            await page.goto('/guarded');
            const guardedHeading = page.locator('guarded-page h1');
            await expect(guardedHeading).not.toBeAttached({ timeout: 3000 });
        });

        test('should show no content (or fallback) for denied route', async ({ page }) =>
        {
            await page.goto('/guarded');
            const outlet = page.locator('router-outlet');
            await expect(outlet).toBeAttached();
            const children = outlet.locator('guarded-page');
            await expect(children).not.toBeAttached({ timeout: 3000 });
        });
    });

    test.describe('link click interception', () =>
    {
        test('should navigate via SPA without full page reload when clicking <a> links', async ({ page }) =>
        {
            await page.goto('/');
            await expect(page.locator('home-page h1')).toContainText('Home');

            const requestUrls: string[] = [];
            page.on('request', (request) =>
            {
                if (request.isNavigationRequest())
                {
                    requestUrls.push(request.url());
                }
            });

            await page.locator('home-page a[href="/about"]').click();
            await expect(page.locator('about-page h1')).toContainText('About');
            expect(page.url()).toContain('/about');

            expect(requestUrls).toHaveLength(0);
        });

        test('should navigate via SPA when clicking [routerLink] links', async ({ page }) =>
        {
            await page.goto('/');
            await expect(page.locator('home-page h1')).toContainText('Home');

            const requestUrls: string[] = [];
            page.on('request', (request) =>
            {
                if (request.isNavigationRequest())
                {
                    requestUrls.push(request.url());
                }
            });

            await page.locator('home-page #router-link-about').click();
            await expect(page.locator('about-page h1')).toContainText('About');
            expect(page.url()).toContain('/about');

            expect(requestUrls).toHaveLength(0);
        });

    });

    test.describe('same-component param change navigation', () =>
    {
        test('should update displayed params when navigating between same-route users', async ({ page }) =>
        {
            await page.goto('/users/1');
            await expect(page.locator('user-page')).toBeVisible();
            await expect(page.locator('user-page .info')).toContainText('1');

            await page.locator('user-page a[href="/users/2?tab=posts"]').click();
            await expect(page.locator('user-page .info')).toContainText('2');
            await expect(page.locator('user-page .info')).toContainText('posts');
        });
    });

    test.describe('nested child routes with params', () =>
    {
        test('should render parent projects-page with project ID', async ({ page }) =>
        {
            await page.goto('/projects/10/overview');
            const heading = page.locator('projects-page h1');
            await expect(heading).toContainText('Project 10');
        });

        test('should render child project-overview inside parent', async ({ page }) =>
        {
            await page.goto('/projects/10/overview');
            const child = page.locator('projects-page router-outlet project-overview');
            await expect(child).toBeAttached();
            await expect(child.locator('.project-id')).toContainText('10');
        });

        test('should render child project-task-page with both params', async ({ page }) =>
        {
            await page.goto('/projects/5/tasks/42');
            const parent = page.locator('projects-page h1');
            await expect(parent).toContainText('Project 5');

            const child = page.locator('projects-page router-outlet project-task-page');
            await expect(child).toBeAttached();
            await expect(child.locator('.project-id')).toContainText('5');
            await expect(child.locator('.task-id')).toContainText('42');
        });

        test('should navigate between child routes via links', async ({ page }) =>
        {
            await page.goto('/projects/10/overview');
            await expect(page.locator('project-overview .project-id')).toContainText('10');

            await page.locator('projects-page a[href="/projects/10/tasks/1"]').click();
            await expect(page.locator('project-task-page .task-id')).toContainText('1');
            await expect(page.locator('project-task-page .project-id')).toContainText('10');
        });

        test('should navigate to different task via link', async ({ page }) =>
        {
            await page.goto('/projects/10/tasks/1');
            await expect(page.locator('project-task-page .task-id')).toContainText('1');

            await page.locator('projects-page a[href="/projects/10/tasks/2"]').click();
            await expect(page.locator('project-task-page .task-id')).toContainText('2');
        });

        test('should render subtask inside task inside project (2 levels deep)', async ({ page }) =>
        {
            await page.goto('/projects/7/tasks/3/subtasks/5');
            const project = page.locator('projects-page h1');
            await expect(project).toContainText('Project 7');

            const task = page.locator('projects-page router-outlet project-task-page');
            await expect(task).toBeAttached();
            await expect(task.locator('.task-id').first()).toContainText('3');

            const subtask = page.locator('project-task-page router-outlet task-subtask-page');
            await expect(subtask).toBeAttached();
            await expect(subtask.locator('.project-id')).toContainText('7');
            await expect(subtask.locator('.task-id')).toContainText('3');
            await expect(subtask.locator('.subtask-id')).toContainText('5');
        });

        test('should navigate between subtasks via links (2 levels deep)', async ({ page }) =>
        {
            await page.goto('/projects/10/tasks/1/subtasks/1');
            await expect(page.locator('task-subtask-page .subtask-id')).toContainText('1');

            await page.locator('project-task-page a[href="/projects/10/tasks/1/subtasks/2"]').click();
            await expect(page.locator('task-subtask-page .subtask-id')).toContainText('2');
        });
    });

    test.describe('BUG #3: navigating during lazy load should not paint both routes', () =>
    {
        test('should only render the final route when navigation interrupts a pending lazy load', async ({ page }) =>
        {
            let releaseChunk: (() => void) | null = null;

            await page.route('**/about-page.component-*', async (route) =>
            {
                await new Promise<void>((resolve) =>
                {
                    releaseChunk = resolve;
                });
                await route.continue();
            });

            await page.goto('/');
            await expect(page.locator('home-page')).toBeAttached();

            page.locator('home-page a[href="/about"]').click()
                .catch(() => {});

            await page.waitForTimeout(200);

            await page.evaluate(() =>
            {
                window.history.pushState(null, '', '/users/1');
                window.dispatchEvent(new PopStateEvent('popstate'));
            });

            await expect(page.locator('user-page')).toBeAttached();

            releaseChunk?.();

            await page.waitForTimeout(500);

            const aboutCount = await page.locator('router-outlet > about-page').count();
            const userCount = await page.locator('router-outlet > user-page').count();

            expect(aboutCount).toBe(0);
            expect(userCount).toBe(1);
        });
    });

    test.describe('BUG #2: route change event should include params', () =>
    {
        test('should populate event params when navigating to parameterized route', async ({ page }) =>
        {
            await page.goto('/event-params/42');
            const injected = page.locator('#injected-param');
            await expect(injected).toContainText('42');

            await page.evaluate(() =>
            {
                window.history.pushState(null, '', '/event-params/99');
                window.dispatchEvent(new PopStateEvent('popstate'));
            });

            const eventParam = page.locator('#event-param');
            await expect(eventParam).toContainText('99');
        });
    });
});
