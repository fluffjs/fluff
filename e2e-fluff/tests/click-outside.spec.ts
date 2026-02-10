import { expect, test } from '@playwright/test';

test.describe('clickOutside directive', () =>
{
    test('should emit when clicking outside the host element', async({ page }) =>
    {
        await page.goto('/');

        const target = page.locator('#click-outside-target');
        const outsideArea = page.locator('#outside-area');
        const countDisplay = page.locator('#click-outside-count');

        await expect(countDisplay).toHaveText('0');

        await outsideArea.click();
        await expect(countDisplay).toHaveText('1');

        await outsideArea.click();
        await expect(countDisplay).toHaveText('2');
    });

    test('should not emit when clicking inside the host element', async({ page }) =>
    {
        await page.goto('/');

        const target = page.locator('#click-outside-target');
        const countDisplay = page.locator('#click-outside-count');

        await expect(countDisplay).toHaveText('0');

        await target.click();
        await expect(countDisplay).toHaveText('0');
    });
});
