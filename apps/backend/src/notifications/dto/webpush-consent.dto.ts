import { Equals, IsString, MaxLength, MinLength } from 'class-validator';
import { WEBPUSH_CONSENT_VERSION } from '../webpush-policy';

export class WebPushTokenDto {
  @IsString() @MinLength(1) @MaxLength(8192) token: string;
}
export class WebPushConsentDto extends WebPushTokenDto {
  @Equals(true) confirmed: true;
  @Equals(WEBPUSH_CONSENT_VERSION) version: string;
}
