import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancePreset, FinancePresetDocument } from './schemas/finance-preset.schema';
import { UpsertFinancePresetDto } from './dto/upsert-finance-preset.dto';

@Injectable()
export class FinancePresetService {
  constructor(@InjectModel(FinancePreset.name) private presetModel: Model<FinancePresetDocument>) {}

  list(organizationId: string, userId: string) {
    return this.presetModel.find({ organizationId, userId }).sort({ name: 1 }).exec();
  }

  create(organizationId: string, userId: string, dto: UpsertFinancePresetDto) {
    return this.presetModel.create({ organizationId, userId, ...dto });
  }

  async update(id: string, organizationId: string, userId: string, dto: UpsertFinancePresetDto) {
    const updated = await this.presetModel.findOneAndUpdate({ _id: id, organizationId, userId }, { $set: dto }, { new: true }).exec();
    if (!updated) throw new NotFoundException('Preset not found');
    return updated;
  }

  async remove(id: string, organizationId: string, userId: string) {
    const result = await this.presetModel.deleteOne({ _id: id, organizationId, userId }).exec();
    if (result.deletedCount === 0) throw new NotFoundException('Preset not found');
  }
}
