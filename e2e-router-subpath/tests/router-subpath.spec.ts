import { expect, test } from '@playwright/test';

test.describe('Fluff Router (subpath /myapp/)', () =>
{
    test.describe('basic routing under subpath', () =>
    {
        test('should load home page at /myapp/', async ({ page }) =>
        {
            await page.goto('/myapp/');
            const heading = page.locator('home-page h1');
            await expect(heading).toContainText('Home');
        });

        test('should load about page at /myapp/about', async ({ page }) =>
        {
            await page.goto('/myapp/about');
            const heading = page.locator('about-page h1');
            await expect(heading).toContainText('About');
        });
    });

    test.describe('link click interception with subpath', () =>
    {
        test('should SPA-navigate for links inside base path', async ({ page }) =>
        {
            await page.goto('/myapp/');
            await expect(page.locator('home-page h1')).toContainText('Home');

            const navigationRequests: string[] = [];
            page.on('request', (request) =>
            {
                if (request.isNavigationRequest())
                {
                    navigationRequests.push(request.url());
                }
            });

            await page.locator('home-page a[href="/myapp/about"]').click();
            await expect(page.locator('about-page h1')).toContainText('About');
            expect(page.url()).toContain('/myapp/about');

            expect(navigationRequests).toHaveLength(0);
        });

        test('should NOT intercept links outside the base path', async ({ page }) =>
        {
            await page.goto('/myapp/');
            await expect(page.locator('home-page h1')).toContainText('Home');

            await page.locator('home-page a[href="/other-app/page"]').click();
            await expect(page.locator('#root-page')).toContainText('Outside Base Path');
            expect(page.url()).toContain('/other-app/page');
        });

        test('should NOT intercept links to external domains', async ({ page }) =>
        {
            await page.goto('/myapp/');
            await expect(page.locator('home-page h1')).toContainText('Home');

            const [request] = await Promise.all([
                page.waitForEvent('request', r => r.isNavigationRequest()),
                page.locator('home-page a[href="https://example.com"]').click()
            ]);

            expect(request.url()).toBe('https://example.com/');
        });
    });
});
