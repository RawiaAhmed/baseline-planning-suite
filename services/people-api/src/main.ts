import { buildServer } from './server';
import { openStore } from './store';

const port = Number(process.env.PEOPLE_API_PORT ?? 4001);
const dataFile = process.env.DATA_FILE ?? 'data/people.json';
const seedFile = process.env.SEED_FILE ?? '../../fixtures/baseline-seed.json';

const store = await openStore(dataFile, seedFile);
const app = buildServer(store);
await app.listen({ port, host: '0.0.0.0' });
