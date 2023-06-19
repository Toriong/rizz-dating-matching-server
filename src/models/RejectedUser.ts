import Mongoose from 'mongoose';
import { RejectedUserInterface } from '../types-and-interfaces/interfaces.js';

const { Schema, models, model, Model } = Mongoose;
let RejectedUser = models.RejectedUsers;

if (!models.RejectedUsers) {
    const milisecondsInADay = 86_400_000;
    const RejectedUserSchema = new Schema<RejectedUserInterface>({
        rejectorUserId: String,
        rejectedUserId: String,
        reason: String,
        expireAt: {
            type: Date,
            default: Date.now() + (milisecondsInADay * 10)
        }

    }, { timestamps: true })
    RejectedUser = model<RejectedUserInterface>('RejectedUsers', RejectedUserSchema);
} 

export { RejectedUser }
