import { NumberFn } from "./types.js";


export interface ExpireAtInterface {
    type: Date;
    default: NumberFn
}

export interface RejectedUserInterface {
    rejectorUserId: string;
    rejectedUserId: string;
    reason?: string | null;
    expireAt?: ExpireAtInterface
}

export interface CRUDResult{
    status: number,
    msg?: String
}