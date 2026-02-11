import express from 'express';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const distDir = resolve(process.argv[2]);
const spa = process.argv.includes('--single');

const app = express();
app.use(express.static(distDir));

const serveJsonPath = join(distDir, 'serve.json');
if (existsSync(serveJsonPath))
{
    const config = JSON.parse(readFileSync(serveJsonPath, 'utf-8'));
    for (const rule of config.rewrites ?? [])
    {
        const pattern = rule.source.replace('**', '{*rest}');
        app.get(pattern, (_req, res) =>
        {
            res.sendFile(join(distDir, rule.destination));
        });
    }
}
else if (spa)
{
    app.get('/{*path}', (_req, res) =>
    {
        const index = join(distDir, 'index.html');
        if (existsSync(index))
        {
            res.sendFile(index);
        }
        else
        {
            res.status(404).end();
        }
    });
}

const server = app.listen(0, '127.0.0.1', () =>
{
    console.log(`Listening on port ${server.address().port}`);
});
