import Mongoose from 'mongoose';
const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86400000;
const ExpireAtSchema = new Schema({
    type: Date,
    default: () => Date.now() + (milisecondsInADay * 10)
});
const RejectedUserSchema = new Schema({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    expireAt: ExpireAtSchema
}, { timestamps: true, _id: false });
const RejectedUser = models.RejectedUsers || model('RejectedUsers', RejectedUserSchema);
export { RejectedUser };
