import { expect, test } from '@playwright/test';

test.describe('Native element @Output binding', () =>
{
    test('should not call whenDefined for native elements like div', async({ page }) =>
    {
        const whenDefinedCalls: string[] = [];

        await page.exposeFunction('__recordWhenDefined', (tagName: string) =>
        {
            whenDefinedCalls.push(tagName);
        });

        await page.addInitScript(() =>
        {
            const originalWhenDefined = customElements.whenDefined.bind(customElements);
            customElements.whenDefined = (name: string): Promise<CustomElementConstructor> =>
            {
                (window as unknown as { __recordWhenDefined: (name: string) => void }).__recordWhenDefined(name);
                return originalWhenDefined(name);
            };
        });

        await page.goto('/');

        await page.waitForTimeout(500);

        const nativeElementCalls = whenDefinedCalls.filter(tag => !tag.includes('-'));
        expect(nativeElementCalls).toEqual([]);
    });
});
