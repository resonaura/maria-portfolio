import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { ImagesController } from './images.controller.js';

@Module({
  imports: [CacheModule],
  controllers: [ImagesController]
})
export class ImagesModule {}
