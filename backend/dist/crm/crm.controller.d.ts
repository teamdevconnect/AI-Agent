import { JwtPayload } from '../auth/jwt-payload.interface';
import { CrmService } from './crm.service';
export declare class CrmController {
    private crmService;
    constructor(crmService: CrmService);
    upsertContact(user: JwtPayload, body: {
        data: Record<string, unknown>;
    }): Promise<{
        contact: import("mongoose").Document<unknown, {}, import("./schemas/contact.schema").ContactDocument, {}, {}> & import("./schemas/contact.schema").Contact & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    searchContactsByIds(user: JwtPayload, body: {
        ids: string[];
    }): Promise<{
        contacts: (import("mongoose").Document<unknown, {}, import("./schemas/contact.schema").ContactDocument, {}, {}> & import("./schemas/contact.schema").Contact & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listContacts(user: JwtPayload, body: {
        search_after?: number;
        limit?: number;
        search_text?: string;
    }): Promise<{
        count: number;
        data: (import("mongoose").Document<unknown, {}, import("./schemas/contact.schema").ContactDocument, {}, {}> & import("./schemas/contact.schema").Contact & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listDeals(user: JwtPayload, body: {
        page?: number;
        offset?: number;
        page_limit?: number;
        search?: string;
        pipelineId?: string;
    }): Promise<{
        total: number;
        deal: (import("mongoose").Document<unknown, {}, import("./schemas/deal.schema").DealDocument, {}, {}> & import("./schemas/deal.schema").Deal & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    getNotes(user: JwtPayload, body: {
        contact_id: string;
        deal_ids?: string[];
        account_ids?: string[];
    }): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/note.schema").NoteDocument, {}, {}> & import("./schemas/note.schema").Note & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    listTags(user: JwtPayload, body: {
        name?: string;
        module_name?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        tags: (import("mongoose").Document<unknown, {}, import("./schemas/tag.schema").TagDocument, {}, {}> & import("./schemas/tag.schema").Tag & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listAccounts(user: JwtPayload, body: {
        name?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: (import("mongoose").Document<unknown, {}, import("./schemas/account.schema").AccountDocument, {}, {}> & import("./schemas/account.schema").Account & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listProducts(user: JwtPayload): {
        count: number;
        product: unknown[];
    };
    listQuotes(user: JwtPayload, body: {
        search?: string;
        deal_id?: string;
        limit?: number;
        startAfter?: number;
    }): Promise<{
        count: number;
        quotes: (import("mongoose").Document<unknown, {}, import("./schemas/quote.schema").QuoteDocument, {}, {}> & import("./schemas/quote.schema").Quote & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
}
