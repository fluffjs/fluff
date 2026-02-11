import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    ...nxE2EPreset(__filename, { testDir: './tests' }),
    use: {
        baseURL: `http://localhost:${process.env['E2E_PORT']}`,
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'node ../scripts/e2e-server.mjs dist',
        wait: { stdout: /Listening on port (?<e2e_port>\d+)/ },
        reuseExistingServer: false,
        cwd: __dirname,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
