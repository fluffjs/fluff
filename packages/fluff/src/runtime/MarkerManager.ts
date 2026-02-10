import type { CompactMarkerConfig } from './FluffBase.js';
import type { MarkerConfigEntries, MarkerManagerInterface } from './MarkerManagerInterface.js';
import { BreakController } from './BreakController.js';
import { ForController } from './ForController.js';
import { IfController } from './IfController.js';
import type { MarkerController } from './MarkerController.js';
import { SwitchController } from './SwitchController.js';
import { TextController } from './TextController.js';

const MARKER_TYPES = ['if', 'for', 'text', 'switch', 'break'] as const;

export class MarkerManager implements MarkerManagerInterface
{
    private readonly controllers = new Map<number, Map<Comment, MarkerController>>();
    private readonly configs = new Map<number, CompactMarkerConfig>();
    private readonly host: HTMLElement;
    private readonly shadowRoot: ShadowRoot;

    public constructor(host: HTMLElement, shadowRoot: ShadowRoot)
    {
        this.host = host;
        this.shadowRoot = shadowRoot;
    }

    public initializeFromConfig(entries: MarkerConfigEntries): void
    {
        this.configs.clear();
        for (const [id, config] of entries)
        {
            this.configs.set(id, config);
        }

        for (const [id] of entries)
        {
            const config = this.configs.get(id);
            if (!config) continue;

            const { startMarker, endMarker } = this.findMarkers(id, MARKER_TYPES[config[0]]);
            if (!startMarker)
            {
                continue;
            }

            const controller = this.createController(id, startMarker, endMarker, config);
            if (controller)
            {
                controller.setMarkerManager(this);
                this.registerController(id, startMarker, controller);
            }
        }

        const controllersToInit: MarkerController[] = [];
        for (const controllersByMarker of this.controllers.values())
        {
            controllersToInit.push(...controllersByMarker.values());
        }
        for (const controller of controllersToInit)
        {
            controller.initialize();
        }
    }

    public ensureController(id: number, type: string, startMarker: Comment, endMarker: Comment | null): MarkerController | undefined
    {
        const existing = this.getController(id, startMarker);
        if (existing)
        {
            return existing;
        }

        const config = this.configs.get(id);
        if (!config || MARKER_TYPES[config[0]] !== type)
        {
            return undefined;
        }

        const controller = this.createController(id, startMarker, endMarker, config);
        if (!controller)
        {
            return undefined;
        }

        controller.setMarkerManager(this);
        this.registerController(id, startMarker, controller);

        return controller;
    }

    public getController(id: number, startMarker: Comment): MarkerController | undefined
    {
        return this.controllers.get(id)
            ?.get(startMarker);
    }

    public cleanupController(id: number, startMarker?: Comment): void
    {
        const controllersForId = this.controllers.get(id);
        if (!controllersForId) return;

        if (startMarker)
        {
            const controller = controllersForId.get(startMarker);
            if (!controller) return;
            controller.cleanup();
            controllersForId.delete(startMarker);
            if (controllersForId.size === 0)
            {
                this.controllers.delete(id);
            }
            return;
        }

        for (const controller of controllersForId.values())
        {
            controller.cleanup();
        }
        this.controllers.delete(id);
    }

    public cleanup(): void
    {
        for (const controllersByMarker of this.controllers.values())
        {
            for (const controller of controllersByMarker.values())
            {
                controller.cleanup();
            }
        }
        this.controllers.clear();
    }

    private registerController(id: number, startMarker: Comment, controller: MarkerController): void
    {
        let controllersForId = this.controllers.get(id);
        if (!controllersForId)
        {
            controllersForId = new Map<Comment, MarkerController>();
            this.controllers.set(id, controllersForId);
        }
        controllersForId.set(startMarker, controller);
    }

    private findMarkers(id: number, type: string): { startMarker: Comment | null; endMarker: Comment | null }
    {
        const startPattern = `fluff:${type}:${id}`;
        const endPattern = `/fluff:${type}:${id}`;

        let startMarker: Comment | null = null;
        let endMarker: Comment | null = null;

        const walker = document.createTreeWalker(this.shadowRoot, NodeFilter.SHOW_COMMENT, null);

        let node = walker.nextNode();
        while (node)
        {
            if (node instanceof Comment)
            {
                if (node.data === startPattern)
                {
                    startMarker = node;
                }
                else if (node.data === endPattern)
                {
                    endMarker = node;
                }
            }
            node = walker.nextNode();
        }

        return { startMarker, endMarker };
    }

    private createController(id: number, startMarker: Comment, endMarker: Comment | null, config: CompactMarkerConfig): MarkerController | null
    {
        switch (config[0])
        {
            case 0: return new IfController(id, startMarker, endMarker, this.host, this.shadowRoot, config);
            case 1: return new ForController(id, startMarker, endMarker, this.host, this.shadowRoot, config);
            case 2: return new TextController(id, startMarker, endMarker, this.host, this.shadowRoot, config);
            case 3: return new SwitchController(id, startMarker, endMarker, this.host, this.shadowRoot, config);
            case 4: return new BreakController(id, startMarker, endMarker, this.host, this.shadowRoot, config);
            default: return null;
        }
    }
}
