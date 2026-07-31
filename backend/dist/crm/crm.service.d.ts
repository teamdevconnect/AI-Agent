import { Model } from 'mongoose';
import { Account, AccountDocument } from './schemas/account.schema';
import { Contact, ContactDocument } from './schemas/contact.schema';
import { Deal, DealDocument } from './schemas/deal.schema';
import { Note, NoteDocument } from './schemas/note.schema';
import { Quote, QuoteDocument } from './schemas/quote.schema';
import { Tag, TagDocument } from './schemas/tag.schema';
export declare class CrmService {
    private contactModel;
    private accountModel;
    private dealModel;
    private quoteModel;
    private noteModel;
    private tagModel;
    constructor(contactModel: Model<ContactDocument>, accountModel: Model<AccountDocument>, dealModel: Model<DealDocument>, quoteModel: Model<QuoteDocument>, noteModel: Model<NoteDocument>, tagModel: Model<TagDocument>);
    upsertContact(organizationId: string, data: Record<string, unknown>): Promise<{
        contact: import("mongoose").Document<unknown, {}, ContactDocument, {}, {}> & Contact & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    searchContactsByIds(organizationId: string, ids: string[]): Promise<{
        contacts: (import("mongoose").Document<unknown, {}, ContactDocument, {}, {}> & Contact & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listContacts(organizationId: string, opts: {
        searchAfter?: number;
        limit?: number;
        searchText?: string;
    }): Promise<{
        count: number;
        data: (import("mongoose").Document<unknown, {}, ContactDocument, {}, {}> & Contact & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listDeals(organizationId: string, opts: {
        page?: number;
        offset?: number;
        pageLimit?: number;
        search?: string;
        pipelineId?: string;
    }): Promise<{
        total: number;
        deal: (import("mongoose").Document<unknown, {}, DealDocument, {}, {}> & Deal & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    getNotes(organizationId: string, contactId: string, dealId?: string, accountId?: string): Promise<(import("mongoose").Document<unknown, {}, NoteDocument, {}, {}> & Note & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    listTags(organizationId: string, opts: {
        name?: string;
        moduleName?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        tags: (import("mongoose").Document<unknown, {}, TagDocument, {}, {}> & Tag & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listAccounts(organizationId: string, opts: {
        name?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: (import("mongoose").Document<unknown, {}, AccountDocument, {}, {}> & Account & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
    listProducts(_organizationId: string): {
        count: number;
        product: unknown[];
    };
    listQuotes(organizationId: string, opts: {
        search?: string;
        dealId?: string;
        limit?: number;
        startAfter?: number;
    }): Promise<{
        count: number;
        quotes: (import("mongoose").Document<unknown, {}, QuoteDocument, {}, {}> & Quote & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }>;
}
