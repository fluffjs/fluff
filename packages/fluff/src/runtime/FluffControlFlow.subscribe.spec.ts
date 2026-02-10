import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { FluffElement } from './FluffElement.js';
import { TestHarness } from './tests/TestHarness.js';

describe('binding.subscribe should trigger re-evaluation', () =>
{
    beforeEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should re-evaluate binding when subscribe property changes', () =>
    {
        let updateCallCount = 0;

        class HostComponent extends FluffElement
        {
            public __filteredTasks = new Property<string[]>(['task1', 'task2']);

            public get filteredTasks(): string[]
            {
                return this.__filteredTasks.getValue() ?? [];
            }

            public set filteredTasks(val: string[])
            {
                this.__filteredTasks.setValue(val);
            }

            public getTasksForColumn(): string[]
            {
                updateCallCount++;
                return this.filteredTasks.filter(t => t.startsWith('task'));
            }

            protected override __render(): void
            {
                this.__getShadowRoot().innerHTML = '<div id="target" data-lid="l0"></div>';
            }

            protected override __setupBindings(): void
            {
                super.__setupBindings();
            }
        }

        TestHarness.setExpressionTable([
            (t: unknown): string[] =>
            {
                if (t instanceof HostComponent)
                {
                    return t.getTasksForColumn();
                }
                throw new Error('Invalid type');
            }
        ], []);
        const bi = FluffBase.__s.length;
        FluffBase.__s.push('tasks');
        HostComponent.__bindings = {
            l0: [[bi, 0, null, 0, { s: 'filteredTasks' }]]
        };

        TestHarness.defineCustomElement('test-subscribe-host', HostComponent);

        const host = TestHarness.mount('test-subscribe-host');
        if (!(host instanceof HostComponent))
        {
            throw new Error('Expected HostComponent');
        }

        expect(updateCallCount)
            .toBeGreaterThan(0);

        const initialCallCount = updateCallCount;

        host.filteredTasks = ['task3', 'task4'];

        expect(updateCallCount)
            .toBeGreaterThan(initialCallCount);

        host.remove();
    });
});
