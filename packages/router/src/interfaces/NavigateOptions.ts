export interface NavigateOptions
{
    readonly queryParams?: Record<string, string>;
    readonly fragment?: string;
    readonly replaceState?: boolean;
}
