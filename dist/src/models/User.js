import Mongoose from 'mongoose';
import { mongoosePagination } from "mongoose-paginate-ts";
const { Schema, models, model } = Mongoose;
let User = models.Users;
if (!models.Users) {
    const UserNames = new Schema({
        first: String,
        last: String,
        nickName: String
    }, { _id: false });
    const UserLocation = new Schema({
        longitude: Number,
        latitude: Number,
    }, { _id: false });
    const UserSchema = new Schema({
        _id: String,
        name: UserNames,
        password: String,
        birthDate: String,
        location: UserLocation,
        bio: String,
        hobbies: [String],
        email: String,
        phoneNum: Number,
        ratingNum: Number,
    }, { timestamps: true });
    UserSchema.plugin(mongoosePagination);
    User = model('users', UserSchema);
}
export default User;
