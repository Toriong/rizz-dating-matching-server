import Mongoose from 'mongoose';
import { mongoosePagination, Pagination } from "mongoose-paginate-ts";

const { Schema, models, model } = Mongoose;
let User = models.Users;

interface UserNames {
    first: string,
    last: string,
    nickName?: string
}

interface UserLocation {
    longitude: number,
    latitude: number,
}

interface UserBaseSchema {
    _id: String,
    name: UserNames,
    password: String,
    birthDate: String,
    location: UserLocation,
    bio: String,
    hobbies: [String],
    email: String,
    phoneNum: Number,
    ratingNum: Number
}

type UserSchemaType = Mongoose.Document & UserBaseSchema

if (!models.Users) {
    const UserNames = new Schema<UserNames>({
        first: String,
        last: String,
        nickName: String
    }, { _id: false })
    const UserLocation = new Schema<UserLocation>({
        longitude: Number,
        latitude: Number,
    }, { _id: false })
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
    }, { timestamps: true })

    UserSchema.plugin(mongoosePagination)

    User = model<UserSchemaType, Pagination<UserSchemaType>>('users', UserSchema);
}



export default User;
