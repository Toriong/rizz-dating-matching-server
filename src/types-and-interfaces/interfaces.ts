import { NumberFn } from "./types.js";


export interface ExpireAtInterface {
    type: Date;
    expires: number
}

export interface RejectedUserInterface {
    _id?: string
    rejectorUserId: string;
    rejectedUserId: string;
    reason?: string | null;
    createdAt?: ExpireAtInterface
}

export interface CRUDResult{
    status: number,
    msg?: String,
    data?: RejectedUserInterface | unknown
}