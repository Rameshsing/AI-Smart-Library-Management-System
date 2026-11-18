import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createLibraryApp } from './src/server/createApp.ts';
import { resolveDatabaseConnectionConfig } from './src/server/dbConfig.ts';
import { LibraryService } from './src/server/libraryService.ts';

async function startServer() {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;
  const dbConfig = resolveDatabaseConnectionConfig(process.env, process.cwd());

  const service = new LibraryService({ dbFilePath: dbConfig.resolvedFilePath });
  const diag = service.getDatabaseDiagnostics();
  console.info(
    `[DB SETUP] engine=${diag.engine} source=${diag.connection_source} target=${diag.target} models_verified=${diag.models_verified} users=${diag.model_counts.users} books=${diag.model_counts.books} external_database_url=${diag.external_database_url_configured}`
  );
  service.runScheduler();

  // Periodic maintenance scheduler (overdue transitions, reminders, pickup expiration, scheduled announcements)
  const schedulerInterval = setInterval(() => {
    try {
      service.runScheduler();
    } catch (err) {
      console.error('Maintenance scheduler pass failed:', err);
    }
  }, 60_000);
  schedulerInterval.unref();

  const app = createLibraryApp(service);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    '/src/assets/images',
    express.static(path.resolve(process.cwd(), 'src/assets/images'), {
      maxAge: isProduction ? '7d' : 0,
    })
  );

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AI Smart Library Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AI Smart Library Server:', err);
  process.exit(1);
});
