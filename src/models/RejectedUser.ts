import Mongoose from 'mongoose';
import { RejectedUserInterface } from '../types-and-interfaces/interfaces.js';

const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86_400_000;
// set a default value for the below
const RejectedUserSchema = new Schema<RejectedUserInterface>({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    expireAt: {
        type: Date,
        default: Date.now() + (milisecondsInADay * 10)
    }

}, { timestamps: true })
const RejectedUser = models.RejectedUsers || model<RejectedUserInterface>('RejectedUsers', RejectedUserSchema);

export { RejectedUser }
