import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { OutlookConnectionDocument } from './schemas/outlook-connection.schema';
export interface OutlookAccountSummary {
    email: string;
    isActive: boolean;
    connectedAt: Date;
}
export declare class OutlookService {
    private config;
    private http;
    private connectionModel;
    constructor(config: ConfigService, http: HttpService, connectionModel: Model<OutlookConnectionDocument>);
    private get configured();
    getEmails(): Promise<{
        id: string;
        from: string;
        subject: string;
        receivedAt: string;
    }[]>;
    getCalendarEvents(): Promise<never[]>;
    getContacts(): Promise<never[]>;
    private placeholderEmails;
    buildAuthorizeUrl(state: string): string;
    handleCallback(code: string, userId: string): Promise<{
        email: string;
    }>;
    getStatus(userId: string): Promise<{
        connected: boolean;
        email?: string;
    }>;
    listAccounts(userId: string): Promise<OutlookAccountSummary[]>;
    setActive(userId: string, email: string): Promise<void>;
    disconnect(userId: string, email: string): Promise<void>;
    private tokenEndpoint;
    private exchangeCode;
    private fetchUserEmail;
}
