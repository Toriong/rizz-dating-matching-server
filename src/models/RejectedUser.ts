import Mongoose from 'mongoose';
import { ExpireAtInterface, RejectedUserInterface } from '../types-and-interfaces/interfaces.js';

function getDefaultExpirationDate(){
    return Date.now() + (milisecondsInADay * 10)
}

const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86_400_000;
// set a default value for the below
const ExpireAtSchema = new Schema<ExpireAtInterface>({
    type: Date,
})
const RejectedUserSchema = new Schema<RejectedUserInterface>({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    expireAt: ExpireAtSchema

}, { timestamps: true })
const RejectedUser = models.RejectedUsers || model<RejectedUserInterface>('RejectedUsers', RejectedUserSchema);

export { RejectedUser }
