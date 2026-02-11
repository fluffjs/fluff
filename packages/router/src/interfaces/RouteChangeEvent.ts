export interface RouteChangeEvent
{
    readonly path: string;
    readonly params: ReadonlyMap<string, string>;
    readonly queryParams: ReadonlyMap<string, string>;
    readonly fragment: string | null;
    readonly previousPath: string | null;
}
