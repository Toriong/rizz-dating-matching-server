import Mongoose from 'mongoose';
import { mongoosePagination } from "mongoose-paginate-ts";
var GemoetryLocationType;
(function (GemoetryLocationType) {
    GemoetryLocationType["type"] = "Point";
})(GemoetryLocationType || (GemoetryLocationType = {}));
const { Schema, models, model } = Mongoose;
let User = models.Users;
if (!models.Users) {
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
export { User };
