import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { OutlookController } from './outlook.controller';
import { OutlookConnection, OutlookConnectionSchema } from './schemas/outlook-connection.schema';
import { OutlookService } from './outlook.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OutlookConnection.name, schema: OutlookConnectionSchema }]),
    HttpModule.register({ timeout: 15_000 }),
    AuthModule,
  ],
  controllers: [OutlookController],
  providers: [OutlookService],
})
export class OutlookModule {}
