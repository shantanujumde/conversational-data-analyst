import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.PORT, () => {
  console.log(`Server listening on http://localhost:${config.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, closing server.`);
  server.close(() => process.exit(0));
  // Don't hang forever on open keep-alive connections.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
