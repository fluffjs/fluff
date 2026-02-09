import { expect, test } from '@playwright/test';

test.describe('SVG elements inside @for loops', () =>
{
    test('should render SVG elements with correct namespace inside @for loop', async({ page }) =>
    {
        await page.goto('/');

        const svg = page.locator('#test-svg');
        await expect(svg).toBeVisible();

        const staticRect = page.locator('#static-rect');
        await expect(staticRect).toBeVisible();

        const namespaceInfo = await page.evaluate(() =>
        {
            const svg = document.querySelector('svg-for-test')?.shadowRoot?.querySelector('#test-svg');
            const staticRect = document.querySelector('svg-for-test')?.shadowRoot?.querySelector('#static-rect');
            const forRects = document.querySelector('svg-for-test')?.shadowRoot?.querySelectorAll('rect.for-rect');
            const forRect = forRects && forRects.length > 0 ? forRects[0] : null;
            
            return {
                svgNamespace: svg?.namespaceURI,
                staticRectNamespace: staticRect?.namespaceURI,
                forRectNamespace: forRect?.namespaceURI,
                forRectTagName: forRect?.tagName,
                forRectCount: forRects?.length ?? 0
            };
        });

        console.log('Namespace info:', JSON.stringify(namespaceInfo, null, 2));

        expect(namespaceInfo.svgNamespace).toBe('http://www.w3.org/2000/svg');
        expect(namespaceInfo.staticRectNamespace).toBe('http://www.w3.org/2000/svg');
        expect(namespaceInfo.forRectNamespace).toBe('http://www.w3.org/2000/svg');
    });

    test('should apply property bindings to SVG elements inside @for loop', async({ page }) =>
    {
        await page.goto('/');

        const bindingInfo = await page.evaluate(() =>
        {
            const forRects = document.querySelector('svg-for-test')?.shadowRoot?.querySelectorAll('rect.for-rect');
            if (!forRects || forRects.length === 0)
            {
                return { rectCount: 0, fills: [] };
            }
            
            const fills = Array.from(forRects).map(rect => rect.getAttribute('fill'));
            return {
                rectCount: forRects.length,
                fills
            };
        });

        console.log('Binding info:', JSON.stringify(bindingInfo, null, 2));

        expect(bindingInfo.rectCount).toBe(3);
        expect(bindingInfo.fills).toEqual(['red', 'green', 'purple']);
    });
});
