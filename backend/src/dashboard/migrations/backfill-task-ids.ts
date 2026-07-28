/**
 * One-off backfill for daily_reports created before tasks had their own
 * _id/status (see DailyReportTask in ../schemas/daily-report.schema.ts).
 * Run once with: npx ts-node src/dashboard/migrations/backfill-task-ids.ts
 * This app has no migration runner — matching how every other schema change
 * this session has been applied (manual, one-off, documented in the plan).
 */
import { connect, disconnect } from 'mongoose';
import { Types } from 'mongoose';

async function main() {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/agent';
  const conn = await connect(uri);
  const collection = conn.connection.collection('daily_reports');

  const cursor = collection.find({ 'tasks.status': { $exists: false } });
  let updated = 0;

  for await (const doc of cursor) {
    const tasks = (doc.tasks ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      _id: t._id ?? new Types.ObjectId(),
      status: t.status ?? 'todo',
    }));
    await collection.updateOne({ _id: doc._id }, { $set: { tasks } });
    updated += 1;
  }

  console.log(`Backfilled ${updated} daily_reports document(s).`);
  await disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
