import Mongoose from 'mongoose';

type NumberFn = () => number;
interface ExpireAtInterface {
    type: Date;
    default: NumberFn
}
interface RejectedUserInterface {
    _id: string;
    rejectedUserId: string;
    reason?: string;
    expireAt?: ExpireAtInterface
    
}

const { Schema, models, model } = Mongoose;
let _RejectedUser;

if (!models.RejectedUsers) {
    const milisecondsInADay = 86_400_000;
    const ExpireAtSchema = new Schema<ExpireAtInterface>({
        type: Date,
        default: () => Date.now() + (milisecondsInADay * 10)
    })
    _RejectedUser = new Schema<RejectedUserInterface>({
        // the id will be the user id of the rejector 
        _id: String,
        rejectedUserId: String,
        reason: String,
        expireAt: ExpireAtSchema

    }, { timestamps: true })
}

const RejectedUser = models.RejectedUsers || model<RejectedUserInterface>('RejectedUsers', _RejectedUser);

export { RejectedUser }
