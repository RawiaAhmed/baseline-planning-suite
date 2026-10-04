import { buildServer } from './server';
import { openStore } from './store';

const port = Number(process.env.DELIVERY_API_PORT ?? 4002);
const dataFile = process.env.DATA_FILE ?? 'data/delivery.json';
const seedFile = process.env.SEED_FILE ?? '../../docs/baseline-seed.json';

const store = await openStore(dataFile, seedFile);
const app = buildServer(store);
await app.listen({ port, host: '0.0.0.0' });
