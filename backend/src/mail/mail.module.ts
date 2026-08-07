import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Global — every module that triggers a transactional email (auth today;
// finance/CRM/workflows for invoice/order/reminder emails later) can inject
// MailService without adding MailModule to its own imports.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
