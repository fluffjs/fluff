import type { CompactBreakConfig } from './FluffBase.js';
import type { RenderContext } from '../interfaces/RenderContext.js';
import { MarkerController } from './MarkerController.js';

export class BreakController extends MarkerController<CompactBreakConfig>
{
    public initialize(): void
    {
    }

    public override updateRenderContext(renderContext?: RenderContext): void
    {
        if (renderContext)
        {
            renderContext.shouldBreak = true;
        }
    }
}
