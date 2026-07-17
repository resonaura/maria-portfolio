import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheVariant } from '../database/cache-variant.entity.js';
import { SourceFile } from '../database/source-file.entity.js';
import { OptimizerService } from '../pipeline/optimizer.service.js';
import { HasherService } from '../pipeline/hasher.service.js';
import { SvgService } from '../pipeline/svg.service.js';
import { CacheService } from './cache.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SourceFile, CacheVariant])],
  providers: [CacheService, HasherService, OptimizerService, SvgService],
  exports: [CacheService]
})
export class CacheModule {}
