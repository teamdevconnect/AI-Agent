import { JwtPayload } from '../auth/jwt-payload.interface';
import { AuditService } from './audit.service';
export declare class AuditController {
    private auditService;
    constructor(auditService: AuditService);
    list(user: JwtPayload): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/audit-log.schema").AuditLogDocument, {}, {}> & import("./schemas/audit-log.schema").AuditLog & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
