export interface RouteContext
{
    readonly path: string;
    readonly params: ReadonlyMap<string, string>;
    readonly queryParams: ReadonlyMap<string, string>;
    readonly fragment: string | null;
}
