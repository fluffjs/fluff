# @fluffjs/router

A compile-time router plugin for [Fluff](https://github.com/fluffjs/fluff). Provides client-side routing with lazy-loaded components, route parameters, query parameters, fragment support, route guards, nested routes, and link interception.

## Installation

```bash
npm install @fluffjs/router
```

## Setup

### 1. Add the plugin to `fluff.json`

```json
{
    "plugins": [
        "@fluffjs/router"
    ],
    "pluginConfig": {
        "@fluffjs/router": {
            "basePath": "/"
        }
    }
}
```

Set `basePath` if your app is served from a subdirectory (e.g. `"/myapp/"`).

### 2. Add `<router-outlet>` to your shell component

```html
<div class="shell">
    <header>My App</header>
    <main>
        <router-outlet></router-outlet>
    </main>
</div>
```

The `<router-outlet>` element is automatically registered by the plugin. It renders the component matching the current URL.

## Defining Routes

Add a `@Router()` decorator to a property on any routed component. The component will be **lazy-loaded** — its import is removed from the entry point and replaced with a dynamic `import()`.

### Basic route

```typescript
import { Component } from '@fluffjs/fluff';
import type { FluffRouter } from '@fluffjs/router/runtime';
import { Router } from '@fluffjs/router/runtime';

@Component({
    selector: 'home-page',
    templateUrl: './home-page.component.html'
})
export class HomePageComponent extends HTMLElement
{
    @Router({
        path: '/',
        pathMatch: 'full'
    })
    public router!: FluffRouter;
}
```

### Route with parameters

Use `:param` syntax for dynamic segments:

```typescript
@Router({
    path: '/users/:id'
})
public router!: FluffRouter;
```

Access parameters via the `FluffRouter` instance:

```typescript
public onInit(): void
{
    const userId = this.router.params.get('id');

    this.router.onParamsChanged((params) =>
    {
        this.userId = params.get('id') ?? '';
    });
}
```

### Wildcard (404) route

```typescript
@Router({
    path: '**'
})
public router!: FluffRouter;
```

### Route with guards

Guards implement the `RouteGuard` interface and can allow or deny navigation:

```typescript
import type { RouteContext, RouteGuard } from '@fluffjs/router/runtime';

export class AuthGuard implements RouteGuard
{
    public canActivate(context: RouteContext): boolean
    {
        return isLoggedIn();
    }
}
```

```typescript
import { AuthGuard } from './auth-guard.js';

@Router({
    path: '/dashboard',
    guard: [AuthGuard]
})
public router!: FluffRouter;
```

Guards run in order. If any guard returns `false`, navigation is cancelled.

### Redirect route

```typescript
@Router({
    path: '/old-path',
    pathMatch: 'full',
    redirectTo: '/new-path'
})
public router!: FluffRouter;
```

### Nested routes

Pass child component classes in the `children` array. The parent component's template must contain its own `<router-outlet>`:

```typescript
import { OverviewComponent } from './overview.component.js';
import { SettingsComponent } from './settings.component.js';

@Router({
    path: '/projects/:id',
    children: [OverviewComponent, SettingsComponent]
})
public router!: FluffRouter;
```

Child routes are matched relative to the parent's path.

## Navigation

### Template links

Standard `<a href="...">` links within the same origin are automatically intercepted and handled as client-side navigations. No special attribute needed.

For dynamic links, use the `routerLink` attribute with property binding:

```html
<a [routerLink]="dynamicPath">Go</a>
```

### Programmatic navigation

```typescript
this.router.navigate('/users/42');

this.router.navigate('/search', {
    queryParams: { q: 'hello' },
    fragment: 'results',
    replaceState: true
});

this.router.back();
this.router.forward();
```

## FluffRouter API

Each routed component receives a `FluffRouter` instance on its decorated property. The instance provides:

| Property / Method | Description |
|---|---|
| `params` | `ReadonlyMap<string, string>` — current route parameters |
| `queryParams` | `ReadonlyMap<string, string>` — current query parameters |
| `fragment` | `string \| null` — current URL fragment |
| `path` | `string` — current path |
| `navigate(path, options?)` | Navigate to a new route |
| `back()` | Go back in history |
| `forward()` | Go forward in history |
| `setQueryParam(key, value)` | Set a single query parameter |
| `removeQueryParam(key)` | Remove a query parameter |
| `setFragment(fragment)` | Set the URL fragment |
| `onRouteChanged(callback)` | Subscribe to route changes (returns `Subscription`) |
| `onParamsChanged(callback)` | Subscribe to parameter changes (returns `Subscription`) |
| `onQueryParamsChanged(callback)` | Subscribe to query parameter changes (returns `Subscription`) |
| `onFragmentChanged(callback)` | Subscribe to fragment changes (returns `Subscription`) |

## RouteConfig Options

| Option | Type | Description |
|---|---|---|
| `path` | `string` | Route path pattern. Supports `:param` segments and `**` wildcard. |
| `pathMatch` | `'full' \| 'prefix'` | Match strategy. Default: `'prefix'`. Routes with children always use `'prefix'`. |
| `guard` | `RouteGuard[]` | Array of guard classes to run before activation. |
| `redirectTo` | `string` | Redirect target path. |
| `children` | `HTMLElement[]` | Child component classes for nested routing. |

## How It Works

The router plugin operates at compile time:

1. **Discovery** — scans components for `@Router()` decorators and extracts route configuration from the AST
2. **Entry point transform** — removes static imports of routed components and replaces them with a route registry that uses dynamic `import()` for lazy loading
3. **Index HTML transform** — injects a `<base href>` tag matching the configured `basePath`
4. **Bundle splitting** — automatically enables esbuild code splitting so lazy-loaded routes are separate chunks
