import type { RouteConfig } from '../interfaces/RouteConfig.js';

export function Router(_options?: RouteConfig): PropertyDecorator
{
    return (_target: object, _propertyKey: string | symbol) =>
    {
    };
}
