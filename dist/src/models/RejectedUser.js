import Mongoose from 'mongoose';
function getDefaultExpirationDate() {
    return Date.now() + (milisecondsInADay * 10);
}
const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86400000;
// set a default value for the below
const ExpireAtSchema = new Schema({
    type: Date,
});
const RejectedUserSchema = new Schema({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    expireAt: ExpireAtSchema
}, { timestamps: true, _id: false });
const RejectedUser = models.RejectedUsers || model('RejectedUsers', RejectedUserSchema);
export { RejectedUser };
