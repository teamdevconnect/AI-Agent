import { ExecutionContext } from '@nestjs/common';
import { ApiTokensService } from '../../api-tokens/api-tokens.service';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    private apiTokensService;
    constructor(apiTokensService: ApiTokensService);
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | import("rxjs").Observable<boolean>;
    private authenticateApiToken;
}
export {};
