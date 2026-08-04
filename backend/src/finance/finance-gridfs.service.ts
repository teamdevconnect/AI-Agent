import { Injectable } from '@nestjs/common';
import { GridFsService } from '../common/gridfs/gridfs.service';

const BUCKET = 'finance_documents';

// Thin wrapper over the shared GridFsService (see common/gridfs/gridfs.service.ts's
// comment — this was the first-ever GridFS consumer in the codebase; Business
// Knowledge becoming the second is what triggered extracting the shared
// implementation). Method signatures kept byte-for-byte identical so
// finance-documents.service.ts needs zero changes.
@Injectable()
export class FinanceGridFsService {
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
