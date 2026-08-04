import { Injectable } from '@nestjs/common';
import { GridFsService } from '../common/gridfs/gridfs.service';

const BUCKET = 'business_knowledge_documents';

@Injectable()
export class BusinessKnowledgeGridFsService {
  constructor(private gridFs: GridFsService) {}

  upload(filename: string, buffer: Buffer, metadata: Record<string, unknown>): Promise<string> {
    return this.gridFs.upload(BUCKET, filename, buffer, metadata);
  }

  openDownloadStream(fileId: string): NodeJS.ReadableStream {
    return this.gridFs.openDownloadStream(BUCKET, fileId);
  }

  delete(fileId: string): Promise<void> {
    return this.gridFs.delete(BUCKET, fileId);
  }
}
