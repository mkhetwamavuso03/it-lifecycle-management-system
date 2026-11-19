import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function start() {
  const mongodb = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongodb.getUri();
  process.env.JWT_SECRET ??= 'local-devicepulse-development-secret';
  process.env.CLIENT_URL ??= 'http://127.0.0.1:4200';
  process.env.NODE_ENV ??= 'development';

  const { seedDatabase } = await import('./seed.js');
  await seedDatabase();
  await import('./index.js');

  const stop = () => {
    void mongodb.stop().finally(() => process.exit());
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
