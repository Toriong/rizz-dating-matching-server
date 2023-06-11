import Mongoose from 'mongoose';
const { Schema, models, model, } = Mongoose;
const milisecondsInADay = 86400000;
// set a default value for the below
const CreatedAtSchema = new Schema({
    type: Date,
    // expires: milisecondsInADay * 10
});
const RejectedUserSchema = new Schema({
    rejectorUserId: String,
    rejectedUserId: String,
    reason: String,
    createdAt: CreatedAtSchema
}, { timestamps: true });
const RejectedUser = models.RejectedUsers || model('RejectedUsers', RejectedUserSchema);
export { RejectedUser };
