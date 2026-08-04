import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';
import { Readable } from 'stream';

// No existing GridFS precedent in this codebase — this is the first use.
// Stores original uploaded files (invoices/receipts/etc.) durably in the
// existing local MongoDB, no new infrastructure/credentials needed (same
// constraint that forced Qdrant Cloud earlier for the vector DB).
//
// Uses mongoose's own re-exported `mongo` driver classes (mongoose.mongo.*)
// rather than importing the standalone `mongodb` package directly — mongoose
// bundles its own copy of the mongodb driver, and TypeScript treats that as
// a structurally different type from a separately-installed top-level
// `mongodb` package, even at the same version (Connection.db wouldn't be
// assignable to a directly-imported GridFSBucket's constructor param).
// Going through mongoose.mongo guarantees the exact same type identity.
@Injectable()
export class FinanceGridFsService {
  private bucket?: mongoose.mongo.GridFSBucket;

  constructor(@InjectConnection() private connection: Connection) {}

  // Lazy getter, not built in onModuleInit — sidesteps any startup-ordering
  // risk between Mongoose's connection and this service's construction.
  private getBucket(): mongoose.mongo.GridFSBucket {
    if (!this.bucket) {
      this.bucket = new mongoose.mongo.GridFSBucket(this.connection.db!, { bucketName: 'finance_documents' });
    }
    return this.bucket;
  }

  async upload(filename: string, buffer: Buffer, metadata: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = this.getBucket().openUploadStream(filename, { metadata });
      Readable.from(buffer)
        .pipe(stream)
        .on('error', reject)
        .on('finish', () => resolve(stream.id.toString()));
    });
  }

  openDownloadStream(fileId: string) {
    return this.getBucket().openDownloadStream(new mongoose.mongo.ObjectId(fileId));
  }

  async delete(fileId: string): Promise<void> {
    await this.getBucket().delete(new mongoose.mongo.ObjectId(fileId));
  }
}
