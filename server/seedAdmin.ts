import { autoSeedAdminIfNeeded } from './firebase';

async function main() {
  console.log('Running standalone seed script...');
  await autoSeedAdminIfNeeded();
  console.log('Seed script finished.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in seed script:', err);
  process.exit(1);
});
