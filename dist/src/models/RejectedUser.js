import Mongoose from 'mongoose';
const { Schema, models, model } = Mongoose;
let RejectedUser = models.RejectedUsers;
if (!models.RejectedUsers) {
    const milisecondsInADay = 86400000;
    const RejectedUserSchema = new Schema({
        rejectorUserId: String,
        rejectedUserId: String,
        reason: String,
        expireAt: {
            type: Date,
            default: Date.now() + (milisecondsInADay * 10)
        }
    }, { timestamps: true });
    RejectedUser = model('RejectedUsers', RejectedUserSchema);
}
export { RejectedUser };
