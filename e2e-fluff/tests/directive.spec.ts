import { expect, test } from '@playwright/test';

test.describe('@Directive decorator', () =>
{
    test.describe('shared bindings edge cases', () =>
    {
        test('should pass same @Input value to component and all directives', async({ page }) =>
        {
            await page.goto('/');

            const source = page.locator('#shared-input-source');
            await expect(source).toHaveText('initial');

            const componentValue = page.locator('#shared-input-component-value');
            await expect(componentValue).toHaveText('component:initial');

            const targetEl = page.locator('#shared-input-target');
            
            type DirectiveWithGetReceivedValue = { getReceivedValue?: () => string; constructor: { name: string } };
            type ElementWithDirectives = HTMLElement & { __fluffDirectives?: DirectiveWithGetReceivedValue[] };
            
            const directiveAValue = await targetEl.evaluate((el) =>
            {
                const directives = (el as ElementWithDirectives).__fluffDirectives ?? [];
                const directiveA = directives.find(d => d.constructor.name === 'SharedInputADirective');
                return directiveA?.getReceivedValue?.() ?? 'missing';
            });
            expect(directiveAValue).toBe('A:initial');

            const directiveBValue = await targetEl.evaluate((el) =>
            {
                const directives = (el as ElementWithDirectives).__fluffDirectives ?? [];
                const directiveB = directives.find(d => d.constructor.name === 'SharedInputBDirective');
                return directiveB?.getReceivedValue?.() ?? 'missing';
            });
            expect(directiveBValue).toBe('B:initial');

            await page.locator('#change-input-btn').click();

            await expect(componentValue).toHaveText('component:updated');

            const updatedA = await targetEl.evaluate((el) =>
            {
                const directives = (el as ElementWithDirectives).__fluffDirectives ?? [];
                const directiveA = directives.find(d => d.constructor.name === 'SharedInputADirective');
                return directiveA?.getReceivedValue?.() ?? 'missing';
            });
            expect(updatedA).toBe('A:updated');

            const updatedB = await targetEl.evaluate((el) =>
            {
                const directives = (el as ElementWithDirectives).__fluffDirectives ?? [];
                const directiveB = directives.find(d => d.constructor.name === 'SharedInputBDirective');
                return directiveB?.getReceivedValue?.() ?? 'missing';
            });
            expect(updatedB).toBe('B:updated');
        });

        test('should subscribe to same @Output from component and all directives', async({ page }) =>
        {
            await page.goto('/');

            const notifyLog = page.locator('#notify-log');
            const target = page.locator('#shared-output-target');

            await expect(notifyLog).toHaveText('');

            await target.click();
            await expect(notifyLog).toHaveText('from-directive-a');

            await target.dblclick();
            await expect(notifyLog).toContainText('from-directive-b');

            await target.click({ button: 'right' });
            await expect(notifyLog).toContainText('from-component');
        });
    });

    test('should apply highlight directive to host element', async({ page }) =>
    {
        await page.goto('/');

        const target = page.locator('#highlight-target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)');
    });

    test('should accept @Input for configurable highlight color', async({ page }) =>
    {
        await page.goto('/');

        const customTarget = page.locator('#highlight-custom');
        await expect(customTarget).toHaveCSS('background-color', 'rgb(0, 255, 0)');
    });

    test('should respond to @HostListener click event', async({ page }) =>
    {
        await page.goto('/');

        const clickTarget = page.locator('#click-counter-target');
        const countDisplay = page.locator('#click-count');

        await expect(countDisplay).toHaveText('0');

        await clickTarget.click();
        await expect(countDisplay).toHaveText('1');

        await clickTarget.click();
        await clickTarget.click();
        await expect(countDisplay).toHaveText('3');
    });

    test('should apply @HostBinding class based on directive state', async({ page }) =>
    {
        await page.goto('/');

        const toggleTarget = page.locator('#toggle-target');
        const toggleBtn = page.locator('#toggle-directive-btn');

        await expect(toggleTarget).not.toHaveClass(/directive-active/);

        await toggleBtn.click();
        await expect(toggleTarget).toHaveClass(/directive-active/);

        await toggleBtn.click();
        await expect(toggleTarget).not.toHaveClass(/directive-active/);
    });

    test('should emit @Output event from directive', async({ page }) =>
    {
        await page.goto('/');

        const hoverTarget = page.locator('#hover-target');
        const hoverStatus = page.locator('#hover-status');

        await expect(hoverStatus).toHaveText('not hovered');

        await hoverTarget.hover();
        await expect(hoverStatus).toHaveText('hovered');
    });
});
