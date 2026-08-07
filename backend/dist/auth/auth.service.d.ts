import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { OAuthProfile, OAuthProviderName } from './oauth.service';
export declare class AuthService {
    private usersService;
    private organizationsService;
    private jwtService;
    private mailService;
    constructor(usersService: UsersService, organizationsService: OrganizationsService, jwtService: JwtService, mailService: MailService);
    register(email: string, password: string, name: string, organizationName: string): Promise<{
        accessToken: string;
    }>;
    private sendVerificationOtp;
    resendVerificationOtp(email: string): Promise<void>;
    verifyEmail(email: string, otp: string): Promise<void>;
    forgotPassword(email: string): Promise<{
        maskedEmail: string;
    }>;
    resetPassword(email: string, otp: string, newPassword: string): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    login(email: string, password: string): Promise<{
        accessToken: string;
    }>;
    loginWithOAuth(provider: OAuthProviderName, profile: OAuthProfile): Promise<{
        accessToken: string;
    }>;
    private registerOAuthUser;
    private issueToken;
}
