import { NumberFn } from "./types.js";


export interface ExpireAtInterface {
    type: Date;
    default: NumberFn
}

export interface RejectedUserInterface {
    _id: string;
    rejectedUserId: string;
    reason?: string;
    expireAt?: ExpireAtInterface
}

export interface CRUDResult{
    status: number,
    msg?: String
}