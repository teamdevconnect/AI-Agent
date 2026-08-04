import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditService } from './audit.service';
export declare class AuditInterceptor implements NestInterceptor {
    private auditService;
    constructor(auditService: AuditService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
