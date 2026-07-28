"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const mongoose_2 = require("mongoose");
async function main() {
    const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/agent';
    const conn = await (0, mongoose_1.connect)(uri);
    const collection = conn.connection.collection('daily_reports');
    const cursor = collection.find({ 'tasks.status': { $exists: false } });
    let updated = 0;
    for await (const doc of cursor) {
        const tasks = (doc.tasks ?? []).map((t) => ({
            ...t,
            _id: t._id ?? new mongoose_2.Types.ObjectId(),
            status: t.status ?? 'todo',
        }));
        await collection.updateOne({ _id: doc._id }, { $set: { tasks } });
        updated += 1;
    }
    console.log(`Backfilled ${updated} daily_reports document(s).`);
    await (0, mongoose_1.disconnect)();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=backfill-task-ids.js.map