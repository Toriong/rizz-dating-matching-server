import Mongoose from 'mongoose';
import { ExpireAtInterface, RejectedUserInterface } from '../types-and-interfaces/interfaces.js';

const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86_400_000;
const ExpireAtSchema = new Schema<ExpireAtInterface>({
    type: Date,
    default: () => Date.now() + (milisecondsInADay * 10)
})
const RejectedUserSchema = new Schema<RejectedUserInterface>({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    expireAt: ExpireAtSchema

}, { timestamps: true, _id: false })
const RejectedUser = models.RejectedUsers || model<RejectedUserInterface>('RejectedUsers', RejectedUserSchema);

export { RejectedUser }
