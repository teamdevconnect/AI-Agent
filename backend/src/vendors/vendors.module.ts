import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { VendorQuote, VendorQuoteSchema } from './schemas/vendor-quote.schema';

// Leaf module — only AuthModule/UsersModule/OrganizationsModule, so both
// FinanceModule and BusinessIntelligenceModule can import it without any
// cycle (neither of those import back into this one).
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: VendorQuote.name, schema: VendorQuoteSchema },
    ]),
    AuthModule,
    UsersModule,
    OrganizationsModule,
  ],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
