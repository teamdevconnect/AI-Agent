import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import { firstValueFrom } from 'rxjs';

interface IngestResult {
  document_id: string;
  chunks: number;
  status: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly agentUrl: string;

  constructor(
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.agentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  async ingest(userId: string, userJwt: string, file: Express.Multer.File): Promise<IngestResult> {
    const form = new FormData();
    form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });
    form.append('user_id', userId);

    const response = await firstValueFrom(
      this.http.post<IngestResult>(`${this.agentUrl}/documents/ingest`, form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${userJwt}` },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }),
    );
    this.logger.log(`Ingested document ${response.data.document_id} (${response.data.chunks} chunks)`);
    return response.data;
  }
}
