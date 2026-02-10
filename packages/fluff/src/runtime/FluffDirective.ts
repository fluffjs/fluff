import { FluffBase } from './FluffBase.js';

export class FluffDirective extends FluffBase
{
    private _hostElement: HTMLElement | null = null;
    private _initialized = false;

    public __setHostElement(hostElement: HTMLElement): void
    {
        this._hostElement = hostElement;
        if ('__assignHostElementProps' in this && typeof this.__assignHostElementProps === 'function')
        {
            this.__assignHostElementProps(hostElement);
        }
    }

    public initialize(): void
    {
        if (this._initialized) return;
        this._initialized = true;

        this.__applyPendingProps();
        this.__initHostBindings();

        if ('onInit' in this && typeof this.onInit === 'function')
        {
            this.onInit();
        }
    }

    public destroy(): void
    {
        if ('onDestroy' in this && typeof this.onDestroy === 'function')
        {
            this.onDestroy();
        }

        for (const sub of this.__baseSubscriptions)
        {
            sub.unsubscribe();
        }
        this.__baseSubscriptions = [];
    }

    protected override __getHostElement(): HTMLElement
    {
        if (!this._hostElement)
        {
            throw new Error('Directive host element not set');
        }
        return this._hostElement;
    }
}
