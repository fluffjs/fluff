import { expect, test } from '@playwright/test';

test.describe('Global HostListener', () =>
{
    test('should handle document:mousemove events', async({ page }) =>
    {
        await page.goto('/');

        const moveResult = page.locator('#mousemove-result');
        const initialCount = Number(await moveResult.textContent());

        await page.mouse.move(100, 100);
        await page.mouse.move(200, 200);
        await page.mouse.move(300, 300);

        await expect(async () =>
        {
            const text = await moveResult.textContent();
            expect(Number(text)).toBeGreaterThan(initialCount);
        }).toPass({ timeout: 5000 });
    });

    test('should handle document:click events', async({ page }) =>
    {
        await page.goto('/');

        const clickResult = page.locator('#click-result');
        await expect(clickResult).toHaveText('0');

        await page.click('body');

        await expect(clickResult).toHaveText('1');

        await page.click('body');

        await expect(clickResult).toHaveText('2');
    });
});
