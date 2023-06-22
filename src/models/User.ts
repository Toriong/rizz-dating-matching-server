import Mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2'


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

interface UserSchemaInterface extends Mongoose.Document {
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
}


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
    const UserSchema = new Schema<UserSchemaInterface>({
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

    UserSchema.plugin(mongoosePaginate)
    User = model('users', UserSchema);
}



export default User;
