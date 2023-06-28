import Mongoose from 'mongoose';
import { mongoosePagination } from "mongoose-paginate-ts";
const { Schema, model } = Mongoose;
const UserNames = new Schema({
    first: String,
    last: String,
    nickName: String
}, { _id: false });
const UserLocation = new Schema({
    type: {
        type: String,
        enum: ['Point'],
        required: true
    },
    coordinates: {
        type: [Number],
        required: true
    }
});
const PictureSchema = new Schema({
    isMatching: Boolean,
    picFileNameOnAws: String
});
const UserSchema = new Schema({
    _id: String,
    name: UserNames,
    password: String,
    birthDate: {
        type: Date,
        required: true
    },
    pics: [PictureSchema],
    location: UserLocation,
    sexAttraction: String,
    bio: String,
    hobbies: [String],
    email: String,
    phoneNum: Number,
    ratingNum: Number,
}, { timestamps: true });
UserSchema.index({ location: '2dsphere' });
UserSchema.plugin(mongoosePagination);
const User = model('users', UserSchema);
export { User };
