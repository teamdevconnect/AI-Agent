import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    me(user: JwtPayload): Promise<{
        id: string;
        email: string;
        name: string;
        roles: string[];
        assignedAgentId: string | undefined;
        active: boolean;
    } | null>;
    list(): Promise<{
        id: string;
        email: string;
        name: string;
        roles: string[];
        assignedAgentId: string | undefined;
        active: boolean;
    }[]>;
    create(dto: CreateUserDto): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            roles: string[];
            assignedAgentId: string | undefined;
            active: boolean;
        };
        tempPassword: string;
    }>;
    update(caller: JwtPayload, id: string, dto: UpdateUserDto): Promise<{
        id: string;
        email: string;
        name: string;
        roles: string[];
        assignedAgentId: string | undefined;
        active: boolean;
    }>;
    remove(caller: JwtPayload, id: string): Promise<void>;
}
