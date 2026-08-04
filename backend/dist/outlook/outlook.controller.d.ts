import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OutlookService } from './outlook.service';
export declare class OutlookController {
    private outlookService;
    private jwtService;
    private config;
    private readonly logger;
    constructor(outlookService: OutlookService, jwtService: JwtService, config: ConfigService);
    getEmails(): Promise<{
        id: string;
        from: string;
        subject: string;
        receivedAt: string;
    }[]>;
    getCalendarEvents(): Promise<never[]>;
    getContacts(): Promise<never[]>;
    getConnectUrl(user: JwtPayload): {
        url: string;
    };
    callback(code?: string, state?: string, error?: string): Promise<{
        url: string;
        statusCode: number;
    }>;
    getStatus(user: JwtPayload): Promise<{
        connected: boolean;
        email?: string;
    }>;
    listAccounts(user: JwtPayload): Promise<import("./outlook.service").OutlookAccountSummary[]>;
    setActive(user: JwtPayload, email: string): Promise<void>;
    disconnectAccount(user: JwtPayload, email: string): Promise<void>;
}
