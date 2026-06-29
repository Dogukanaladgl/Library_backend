import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Yalnızca kütüphane panel JWT'si (type: panel) kabul eder */
@Injectable()
export class PanelJwtGuard extends AuthGuard('panel-jwt') {}
