export interface MatchResult
{
    readonly params: Map<string, string>;
    readonly path: string;
    readonly isWildcard: boolean;
    readonly remainingPath: string;
}
