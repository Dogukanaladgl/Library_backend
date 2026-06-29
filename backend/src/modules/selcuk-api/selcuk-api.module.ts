import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import selcukApiConfig from './selcuk-api.config';
import { SelcukApiService } from './selcuk-api.service';

@Module({
  imports: [ConfigModule.forFeature(selcukApiConfig)],
  providers: [SelcukApiService],
  exports: [SelcukApiService],
})
export class SelcukApiModule {}
