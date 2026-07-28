import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditEntry {
  userId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>) {}

  // Fire-and-forget from AuditInterceptor — a failure here (e.g. Mongo
  // briefly unreachable) must never fail, delay, or retry the request it's
  // auditing. Logged locally so a systemic audit-write failure is still
  // visible somewhere, just never at the expense of the actual request.
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create(entry);
    } catch (err) {
      this.logger.warn(`Failed to write audit log entry: ${(err as Error).message}`);
    }
  }

  list(limit = 200) {
    return this.auditModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }
}
