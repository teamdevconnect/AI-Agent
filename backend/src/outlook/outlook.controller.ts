import { Controller, Delete, Get, Logger, Param, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OutlookService } from './outlook.service';

@Controller('outlook')
export class OutlookController {
  private readonly logger = new Logger(OutlookController.name);

  constructor(
    private outlookService: OutlookService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('emails')
  getEmails() {
    return this.outlookService.getEmails();
  }

  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  getCalendarEvents() {
    return this.outlookService.getCalendarEvents();
  }

  @UseGuards(JwtAuthGuard)
  @Get('contacts')
  getContacts() {
    return this.outlookService.getContacts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('connect-url')
  getConnectUrl(@CurrentUser() user: JwtPayload) {
    // Short-lived JWT as OAuth `state` — carries the user id through the
    // Microsoft redirect round-trip without needing a server session.
    const state = this.jwtService.sign({ sub: user.sub }, { expiresIn: '10m' });
    return { url: this.outlookService.buildAuthorizeUrl(state) };
  }

  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const frontendUrl = this.config.get<string>('corsOrigin');
    if (error || !code || !state) {
      this.logger.warn(`Outlook callback missing params (error=${error})`);
      return { url: `${frontendUrl}/chat?outlook=error`, statusCode: 302 };
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(state);
      await this.outlookService.handleCallback(code, payload.sub);
      return { url: `${frontendUrl}/chat?outlook=connected`, statusCode: 302 };
    } catch (err) {
      const detail = (err as { response?: { data?: unknown } }).response?.data ?? (err as Error).message;
      this.logger.error(`Outlook callback failed: ${JSON.stringify(detail)}`);
      return { url: `${frontendUrl}/chat?outlook=error`, statusCode: 302 };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@CurrentUser() user: JwtPayload) {
    return this.outlookService.getStatus(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  listAccounts(@CurrentUser() user: JwtPayload) {
    return this.outlookService.listAccounts(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accounts/:email/activate')
  setActive(@CurrentUser() user: JwtPayload, @Param('email') email: string) {
    return this.outlookService.setActive(user.sub, decodeURIComponent(email));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('accounts/:email')
  disconnectAccount(@CurrentUser() user: JwtPayload, @Param('email') email: string) {
    return this.outlookService.disconnect(user.sub, decodeURIComponent(email));
  }
}