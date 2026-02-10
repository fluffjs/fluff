import { Property } from '../../utils/Property.js';
import { FluffBase } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';
import type { TaskStats } from './TaskStats.js';

export class TestSwitchReinsertBindsInputChildComponent extends FluffElement
{
    private readonly __stats = new Property<TaskStats>({
        initialValue: {
            total: 0,
            byStatus: { 'todo': 0, 'in-progress': 0, 'done': 0 },
            byPriority: { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 },
            overdue: 0,
            dueToday: 0
        },
        propertyName: 'stats'
    });

    public get stats(): TaskStats
    {
        return this.__stats.getValue() ?? {
            total: 0,
            byStatus: { 'todo': 0, 'in-progress': 0, 'done': 0 },
            byPriority: { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 },
            overdue: 0,
            dueToday: 0
        };
    }

    public set stats(value: TaskStats)
    {
        this.__stats.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <div class="total"><!--fluff:text:0--><!--/fluff:text:0--></div>
                `;

        const si = FluffBase.__s.length;
        FluffBase.__s.push('stats');
        this.__setMarkerConfigs([
            [0, [2, 4, [si], null]]
        ]);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
