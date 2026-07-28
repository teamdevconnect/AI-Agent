import { Body, Controller, Post } from '@nestjs/common';
<<<<<<< HEAD
=======
import { Throttle } from '@nestjs/throttler';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

<<<<<<< HEAD
=======
// Tighter than the app-wide default (see ThrottlerModule.forRoot in
// app.module.ts) — these are the two routes a credential-stuffing/brute-force
// attempt would actually hit, so they get their own stricter ceiling.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

>>>>>>> 6a60a8648 (Initial AI Agent source code)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

<<<<<<< HEAD
=======
  @Throttle(AUTH_THROTTLE)
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

<<<<<<< HEAD
=======
  @Throttle(AUTH_THROTTLE)
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
