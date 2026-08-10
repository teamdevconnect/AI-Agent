"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const mail_service_1 = require("../mail/mail.service");
const organizations_service_1 = require("../organizations/organizations.service");
const users_service_1 = require("../users/users.service");
const SALT_ROUNDS = 12;
const VERIFY_OTP_TTL_MS = 10 * 60 * 1000;
const RESET_OTP_TTL_MS = 15 * 60 * 1000;
const GENERIC_OTP_ERROR = 'Invalid or expired code';
let AuthService = class AuthService {
    constructor(usersService, organizationsService, jwtService, mailService) {
        this.usersService = usersService;
        this.organizationsService = organizationsService;
        this.jwtService = jwtService;
        this.mailService = mailService;
    }
    async register(email, password, name, organizationName) {
        const existing = await this.usersService.findByEmail(email);
        if (existing) {
            throw new common_1.ConflictException('An account with this email already exists');
        }
        const { organization, store } = await this.organizationsService.createOrganizationWithOwner(organizationName);
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await this.usersService.create({
            email,
            passwordHash,
            name,
            organizationId: organization._id.toString(),
            storeId: store._id.toString(),
            roles: ['owner', 'admin'],
        });
        void this.sendVerificationOtp(user);
        void this.mailService.sendWelcomeEmail(user.email, user.name);
        return this.issueToken(user);
    }
    async sendVerificationOtp(user) {
        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
        await this.usersService.setVerifyOtp(user._id.toString(), otpHash, new Date(Date.now() + VERIFY_OTP_TTL_MS));
        await this.mailService.sendVerificationOtp(user.email, otp);
    }
    async resendVerificationOtp(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user || user.emailVerified)
            return;
        await this.sendVerificationOtp(user);
    }
    async verifyEmail(email, otp) {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.verifyOtpHash || !user.verifyOtpExpiresAt || user.verifyOtpExpiresAt < new Date()) {
            throw new common_1.UnauthorizedException(GENERIC_OTP_ERROR);
        }
        if (!(await bcrypt.compare(otp, user.verifyOtpHash))) {
            throw new common_1.UnauthorizedException(GENERIC_OTP_ERROR);
        }
        await this.usersService.markEmailVerified(user._id.toString());
    }
    async forgotPassword(email) {
        const user = await this.usersService.findByEmail(email);
        if (user) {
            const otp = generateOtp();
            const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
            await this.usersService.setResetOtp(user._id.toString(), otpHash, new Date(Date.now() + RESET_OTP_TTL_MS));
            void this.mailService.sendPasswordResetOtp(user.email, otp);
        }
        return { maskedEmail: maskEmail(email) };
    }
    async resetPassword(email, otp, newPassword) {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt || user.resetOtpExpiresAt < new Date()) {
            throw new common_1.UnauthorizedException(GENERIC_OTP_ERROR);
        }
        if (!(await bcrypt.compare(otp, user.resetOtpHash))) {
            throw new common_1.UnauthorizedException(GENERIC_OTP_ERROR);
        }
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.usersService.resetPassword(user._id.toString(), passwordHash);
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid session');
        }
        if (!user.passwordHash) {
            throw new common_1.BadRequestException('This account signs in via Google/Microsoft/GitHub and has no password to change — use "Forgot password" on the login page to set one.');
        }
        if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.usersService.resetPassword(userId, passwordHash);
    }
    async login(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.active === false) {
            throw new common_1.UnauthorizedException('Account disabled');
        }
        return this.issueToken(user);
    }
    async loginWithOAuth(provider, profile) {
        let user = await this.usersService.findByOAuthId(provider, profile.providerId);
        if (!user) {
            const existing = await this.usersService.findByEmail(profile.email);
            if (existing) {
                await this.usersService.linkOAuthProvider(existing._id.toString(), provider, profile.providerId);
                user = existing;
            }
            else {
                user = await this.registerOAuthUser(provider, profile);
            }
        }
        if (user.active === false) {
            throw new common_1.UnauthorizedException('Account disabled');
        }
        return this.issueToken(user);
    }
    async registerOAuthUser(provider, profile) {
        const { organization, store } = await this.organizationsService.createOrganizationWithOwner(`${profile.name}'s Workspace`);
        const user = await this.usersService.create({
            email: profile.email,
            name: profile.name,
            organizationId: organization._id.toString(),
            storeId: store._id.toString(),
            roles: ['owner', 'admin'],
        });
        await this.usersService.linkOAuthProvider(user._id.toString(), provider, profile.providerId);
        await this.usersService.markEmailVerified(user._id.toString());
        void this.mailService.sendWelcomeEmail(user.email, user.name);
        return user;
    }
    issueToken(user) {
        const payload = {
            sub: user._id.toString(),
            email: user.email,
            roles: user.roles,
            organizationId: user.organizationId,
            storeId: user.storeId,
            assignedAgentId: user.assignedAgentId,
            department: user.department,
        };
        return { accessToken: this.jwtService.sign(payload) };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        organizations_service_1.OrganizationsService,
        jwt_1.JwtService,
        mail_service_1.MailService])
], AuthService);
function generateOtp() {
    return String((0, crypto_1.randomInt)(100_000, 1_000_000));
}
function maskEmail(email) {
    const [name, domain] = email.split('@');
    const masked = name && name.length > 2 ? `${name.slice(0, 2)}${'*'.repeat(name.length - 2)}` : `${name?.[0] ?? ''}*`;
    return `${masked}@${domain ?? 'example.com'}`;
}
//# sourceMappingURL=auth.service.js.map