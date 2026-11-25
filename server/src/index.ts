import { createPlanner } from './ai/provider';
import { createApp } from './app';
import { type Config, ConfigError, loadConfig } from './config';
import { type Db, openReadOnly } from './db/connection';
import { createLogger } from './logger';

function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(err.message);
    process.exit(1);
  }
}

const config = loadConfigOrExit();
const logger = createLogger(config.LOG_LEVEL);

function openDatabaseOrExit(): Db {
  try {
    return openReadOnly(config.DATABASE_PATH);
  } catch (err) {
    logger.fatal(
      { err, path: config.DATABASE_PATH },
      'Could not open the database. Run `npm run db:seed` first.',
    );
    process.exit(1);
  }
}

const db = openDatabaseOrExit();
const planner = createPlanner(config);
const app = createApp({ config, db, planner, logger });

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, provider: planner.provider, model: planner.model },
    `Server listening on http://localhost:${config.PORT}`,
  );
});

let closing = false;
function shutdown(exitCode: number) {
  if (closing) return;
  closing = true;
  server.close(() => {
    db.close();
    process.exit(exitCode);
  });
  // Don't hang forever on open keep-alive connections.
  setTimeout(() => process.exit(exitCode), 5_000).unref();
}

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server.');
  shutdown(0);
});
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server.');
  shutdown(0);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  shutdown(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown(1);
});
