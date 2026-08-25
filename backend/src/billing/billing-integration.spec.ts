import { ConfigService } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import { Wallet, WalletDocument, WalletSchema } from './schemas/wallet.schema';
import { WalletTransaction, WalletTransactionDocument, WalletTransactionSchema } from './schemas/wallet-transaction.schema';
import { WebhookEvent, WebhookEventDocument, WebhookEventSchema } from './schemas/webhook-event.schema';
import { WalletService } from './wallet.service';

// Real-Mongo integration tests (this project's established live-testing
// convention — see jest.setup.js) covering the spec's required cases that
// only make sense against a real atomic upsert: free-trial idempotency,
// payment-webhook idempotency, and tenant data isolation. Everything here
// runs against a disposable, uniquely-prefixed set of organizationIds so it
// never collides with real data, and cleans up after itself.

const TEST_PREFIX = `jest-billing-${Date.now()}`;
const orgA = `${TEST_PREFIX}-org-a`;
const orgB = `${TEST_PREFIX}-org-b`;

describe('Billing integration (real Mongo)', () => {
  let connection: Connection;
  let walletService: WalletService;
  let walletModel: Model<WalletDocument>;
  let transactionModel: Model<WalletTransactionDocument>;
  let webhookEventModel: Model<WebhookEventDocument>;

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI/MONGO_URI must be set to run billing integration tests.');

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: Wallet.name, schema: WalletSchema },
          { name: WalletTransaction.name, schema: WalletTransactionSchema },
          { name: WebhookEvent.name, schema: WebhookEventSchema },
        ]),
      ],
      providers: [
        WalletService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'billing.freeTrialCredits' ? 20 : key === 'billing.autoRechargeDefault' ? false : undefined),
          },
        },
      ],
    }).compile();

    connection = moduleRef.get(getModelToken(Wallet.name)).db;
    walletService = moduleRef.get(WalletService);
    walletModel = moduleRef.get(getModelToken(Wallet.name));
    transactionModel = moduleRef.get(getModelToken(WalletTransaction.name));
    webhookEventModel = moduleRef.get(getModelToken(WebhookEvent.name));
  });

  afterAll(async () => {
    await walletModel.deleteMany({ organizationId: { $regex: `^${TEST_PREFIX}` } });
    await transactionModel.deleteMany({ organizationId: { $regex: `^${TEST_PREFIX}` } });
    await webhookEventModel.deleteMany({ eventId: { $regex: `^${TEST_PREFIX}` } });
    await connection.close();
  });

  describe('Free trial (spec §9/§10/§49)', () => {
    it('grants exactly 20 credits on first wallet creation, with an auditable FREE_TRIAL ledger row', async () => {
      const wallet = await walletService.getOrCreateWallet(orgA);
      expect(wallet.balanceCredits).toBe(20);

      const trialRows = await transactionModel.find({ organizationId: orgA, type: 'FREE_TRIAL' });
      expect(trialRows).toHaveLength(1);
      expect(trialRows[0].amountCredits).toBe(20);
      expect(trialRows[0].balanceAfterCredits).toBe(20);
    });

    it('never grants the trial twice — duplicate/concurrent creation calls are idempotent', async () => {
      // Simulates the exact race the spec worries about: several calls for
      // an org that doesn't have a wallet yet, all arriving concurrently.
      const raceOrg = `${TEST_PREFIX}-org-race`;
      const results = await Promise.all(Array.from({ length: 8 }, () => walletService.getOrCreateWallet(raceOrg)));
      expect(results.every((w) => w.balanceCredits === 20)).toBe(true);

      const trialRows = await transactionModel.find({ organizationId: raceOrg, type: 'FREE_TRIAL' });
      expect(trialRows).toHaveLength(1); // exactly one grant, not 8

      const wallet = await walletModel.findOne({ organizationId: raceOrg });
      expect(wallet?.balanceCredits).toBe(20); // not 160 (20 x 8)

      await walletModel.deleteMany({ organizationId: raceOrg });
      await transactionModel.deleteMany({ organizationId: raceOrg });
    });

    it('a second call against an already-existing wallet does not re-grant', async () => {
      await walletService.getOrCreateWallet(orgA); // orgA's wallet already exists from the first test
      const trialRows = await transactionModel.find({ organizationId: orgA, type: 'FREE_TRIAL' });
      expect(trialRows).toHaveLength(1); // still exactly one
    });
  });

  describe('Payment webhook idempotency (spec §28/§49)', () => {
    it('a duplicate eventId is rejected by the unique index — exactly one row survives', async () => {
      const eventId = `${TEST_PREFIX}:duplicate-test`;
      await webhookEventModel.create({ eventId, provider: 'razorpay', payload: { seq: 1 } });

      await expect(webhookEventModel.create({ eventId, provider: 'razorpay', payload: { seq: 2 } })).rejects.toThrow();

      const rows = await webhookEventModel.find({ eventId });
      expect(rows).toHaveLength(1);
      expect(rows[0].payload).toEqual({ seq: 1 }); // the first delivery won, not overwritten
    });
  });

  describe('Tenant isolation (spec §3/§4/§38)', () => {
    it('two organizations never share a wallet, and each only ever sees its own balance', async () => {
      const walletA = await walletService.getOrCreateWallet(orgA);
      const walletB = await walletService.getOrCreateWallet(orgB);
      expect(walletA._id.toString()).not.toBe(walletB._id.toString());

      await walletService.applyLedgerEntry(orgA, 'MANUAL_ADJUSTMENT', 500, { createdBy: 'test' });

      const summaryA = await walletService.getSummary(orgA, 200);
      const summaryB = await walletService.getSummary(orgB, 200);
      expect(summaryA.balanceCredits).toBe(520); // 20 trial + 500 adjustment
      expect(summaryB.balanceCredits).toBe(20); // untouched — orgA's credit did not leak into orgB
    });

    it("org A's transaction listing never contains org B's rows", async () => {
      await walletService.applyLedgerEntry(orgB, 'MANUAL_ADJUSTMENT', 999, { createdBy: 'test' });

      const txA = await walletService.listTransactions(orgA, 50);
      const txB = await walletService.listTransactions(orgB, 50);

      expect(txA.every((t) => t.organizationId === orgA)).toBe(true);
      expect(txB.every((t) => t.organizationId === orgB)).toBe(true);
      expect(txA.some((t) => t.amountCredits === 999)).toBe(false); // orgB's row never appears in orgA's list
    });

    it('reserving credits against org A never touches org B balance/reservedCredits', async () => {
      const before = await walletService.getSummary(orgB, 200);
      const walletA = await walletService.getOrCreateWallet(orgA);
      await walletService.tryReserve(walletA._id.toString(), 10);
      const after = await walletService.getSummary(orgB, 200);
      expect(after.balanceCredits).toBe(before.balanceCredits);
      expect(after.reservedCredits).toBe(before.reservedCredits);
    });
  });
});
