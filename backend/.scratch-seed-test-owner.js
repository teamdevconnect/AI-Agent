const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017/agent');
  await client.connect();
  const db = client.db();
  const email = 'zz-verify-owner-mapping@example.com';
  const password = 'TempVerify789!';
  const organizationId = '6a7c1f0a9a0cfda5a4d3f5b2';

  await db.collection('users').deleteOne({ email });

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const result = await db.collection('users').insertOne({
    email,
    passwordHash,
    name: 'Verify Owner Mapping (temp)',
    organizationId,
    roles: ['owner', 'admin'],
    active: true,
    sessions: [],
    pushSubscriptions: [],
    createdAt: now,
    updatedAt: now,
  });

  console.log(JSON.stringify({ userId: result.insertedId.toString(), email, password }));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
