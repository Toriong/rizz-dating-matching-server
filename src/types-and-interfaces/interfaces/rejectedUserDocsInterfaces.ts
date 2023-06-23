
interface ExpireAtInterface {
    type: Date;
    expires: number
}

interface RejectedUserInterface {
    _id?: string
    rejectorUserId: string;
    rejectedUserId: string;
    reason?: string | null;
    expireAt?: ExpireAtInterface
}

export { RejectedUserInterface, ExpireAtInterface }