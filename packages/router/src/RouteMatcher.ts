import type { MatchResult } from './interfaces/MatchResult.js';

export class RouteMatcher
{
    public static match(pattern: string, actualPath: string, pathMatch: 'full' | 'prefix'): MatchResult | null
    {
        if (pattern === '**')
        {
            return {
                params: new Map<string, string>(),
                path: actualPath,
                isWildcard: true,
                remainingPath: ''
            };
        }

        const patternSegments = RouteMatcher.splitSegments(pattern);
        const pathSegments = RouteMatcher.splitSegments(actualPath);

        if (pathMatch === 'full' && patternSegments.length !== pathSegments.length)
        {
            return null;
        }

        if (patternSegments.length > pathSegments.length)
        {
            return null;
        }

        const params = new Map<string, string>();

        for (let i = 0; i < patternSegments.length; i++)
        {
            const patternSeg = patternSegments[i];
            const pathSeg = pathSegments[i];

            if (patternSeg.startsWith(':'))
            {
                params.set(patternSeg.slice(1), decodeURIComponent(pathSeg));
            }
            else if (patternSeg === '**')
            {
                const remaining = pathSegments.slice(i)
                    .join('/');
                return {
                    params,
                    path: pathSegments.slice(0, i)
                        .join('/') || '/',
                    isWildcard: true,
                    remainingPath: remaining
                };
            }
            else if (patternSeg !== pathSeg)
            {
                return null;
            }
        }

        const matchedPath = pathSegments.slice(0, patternSegments.length)
            .join('/') || '/';
        const remainingPath = pathSegments.slice(patternSegments.length)
            .join('/');

        return {
            params,
            path: matchedPath,
            isWildcard: false,
            remainingPath
        };
    }

    public static splitSegments(path: string): string[]
    {
        return path.split('/')
            .filter(s => s.length > 0);
    }

    public static normalizePath(path: string): string
    {
        const cleaned = '/' + path.replace(/\/+/g, '/')
            .replace(/^\/|\/$/g, '');
        return cleaned === '' ? '/' : cleaned;
    }
}
