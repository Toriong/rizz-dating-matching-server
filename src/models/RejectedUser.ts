import Mongoose from 'mongoose';
import { ExpireAtInterface, RejectedUserInterface } from '../types-and-interfaces/interfaces.js';

const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86_400_000;
// set a default value for the below
const CreatedAtSchema = new Schema<ExpireAtInterface>({
    type: Date,
    // expires: milisecondsInADay * 10
})
const RejectedUserSchema = new Schema<RejectedUserInterface>({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    createdAt: CreatedAtSchema

}, { timestamps: true })
const RejectedUser = models.RejectedUsers || model<RejectedUserInterface>('RejectedUsers', RejectedUserSchema);

export { RejectedUser }
