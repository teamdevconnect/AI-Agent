import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Tighter than the app-wide default (see ThrottlerModule.forRoot in
// app.module.ts) — these are the two routes a credential-stuffing/brute-force
// attempt would actually hit, so they get their own stricter ceiling.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name, dto.organizationName);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
