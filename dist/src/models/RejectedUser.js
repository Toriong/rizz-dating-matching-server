import Mongoose from 'mongoose';
const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86400000;
// set a default value for the below
const RejectedUserSchema = new Schema({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    expireAt: {
        type: Date,
        default: Date.now() + (milisecondsInADay * 10)
    }
}, { timestamps: true });
const RejectedUser = models.RejectedUsers || model('RejectedUsers', RejectedUserSchema);
export { RejectedUser };
