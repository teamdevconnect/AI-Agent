import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export interface IngestResult {
    document_id: string;
    chunks: number;
    status: string;
}
export declare class DocumentsService {
    private http;
    private config;
    private readonly logger;
    private readonly agentUrl;
    constructor(http: HttpService, config: ConfigService);
    ingest(userId: string, userJwt: string, file: Express.Multer.File): Promise<IngestResult>;
}
