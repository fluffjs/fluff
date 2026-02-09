import { expect, test } from '@playwright/test';

test.describe('Native property in non-decorated class', () =>
{
    test('should subscribe to Property passed to @Input and update native element', async({ page }) =>
    {
        await page.goto('/');

        const input = page.locator('#native-property-input');
        const btn = page.locator('#native-property-toggle');

        await expect(input).toBeDisabled();

        await btn.click();
        await expect(input).toBeEnabled();

        await btn.click();
        await expect(input).toBeDisabled();
    });
});
