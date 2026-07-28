import { ConfigService } from '@nestjs/config';
export declare class RedisCacheService {
    private readonly logger;
    private readonly client;
    constructor(config: ConfigService);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
    del(...keys: string[]): Promise<void>;
}
