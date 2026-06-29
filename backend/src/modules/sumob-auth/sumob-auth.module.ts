import { Global, Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../database/entities';

import { MobilDbService } from './mobil-db.service';

import { SumobAuthService } from './sumob-auth.service';

import { SumobAuthGuard } from './sumob-auth.guard';

import sumobConfig from './sumob-auth.config';



@Global()

@Module({

  imports: [

    ConfigModule.forFeature(sumobConfig),

    TypeOrmModule.forFeature([User]),

  ],

  providers: [MobilDbService, SumobAuthService, SumobAuthGuard],

  exports: [SumobAuthService, SumobAuthGuard],

})

export class SumobAuthModule {}


