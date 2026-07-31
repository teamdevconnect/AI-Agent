import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
export declare class AuthService {
    private usersService;
    private organizationsService;
    private jwtService;
    constructor(usersService: UsersService, organizationsService: OrganizationsService, jwtService: JwtService);
    register(email: string, password: string, name: string, organizationName: string): Promise<{
        accessToken: string;
    }>;
    login(email: string, password: string): Promise<{
        accessToken: string;
    }>;
    private issueToken;
}
