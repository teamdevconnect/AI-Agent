import { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DocumentsService } from './documents.service';
export declare class DocumentsController {
    private documentsService;
    constructor(documentsService: DocumentsService);
    upload(user: JwtPayload, req: Request, file: Express.Multer.File): Promise<import("./documents.service").IngestResult>;
}
