import { UnauthorizedException } from '@nestjs/common';

export class SelcukAuthException extends UnauthorizedException {
  constructor(
    message: string,
    readonly errorCode?: string,
  ) {
    super(message);
  }
}
