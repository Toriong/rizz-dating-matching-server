import Mongoose, { Document, Model } from 'mongoose';
import { mongoosePagination, Pagination, PaginationModel } from "mongoose-paginate-ts";

type Sex = 'male' | 'female'
type SortObjVal = 'asc' | 'ascending' | 'desc' | 'descending' | 1 | -1;
type KeysForPaginationQuerying = Pick<UserBaseModelSchema, "birthDate" | "sex">;
type SelectType = { [KeyName in keyof UserBaseModelSchema]: 0 | 1 }
type PaginateFn = (paginationArgsOpts: PaginationArgsOpts) => Promise<ReturnTypeOfPaginateFn>;
interface UserBaseModelSchema {
    _id: String,
    name: UserNames,
    password: String,
    birthDate: Number,
    sex: Sex,
    location: UserLocation,
    bio: String,
    hobbies: [String],
    email: String,
    phoneNum: Number,
    ratingNum: Number
}
interface UserNames {
    first: string,
    last: string,
    nickName?: string
}
interface UserLocation {
    longitude: number,
    latitude: number,
}
interface SortObj {
    ratingNum: SortObjVal
}
interface PaginationArgsOpts {
    query: KeysForPaginationQuerying,
    select?: SelectType,
    sort: SortObj
}
interface ReturnTypeOfPaginateFn {
    totalDocs: number | undefined;
    limit: number | undefined;
    totalPages: number | undefined;
    page: number | undefined;
    pagingCounter: number | undefined;
    hasPrevPage: Boolean | undefined
    hasNextPage: Boolean | undefined
    prevPage: number | undefined;
    nextPage: number | undefined;
    hasMore: Boolean | undefined
    docs: UserBaseModelSchema[]
}
interface PaginatedModel extends Mongoose.Model<Document> {
    paginate: PaginateFn
}

const { Schema, models, model } = Mongoose;
let User = models.Users;

// GOAL: create a function that will be the pagination function, this will return a promise of all of the users that the current user queried for 
// the result of the pagination function is a promise
// the pagination function will take in the query options, create a interface for the query options  

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
    const UserSchema = new Schema<UserBaseModelSchema>({
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

    User = model('users', UserSchema);
}



export { User, PaginatedModel, ReturnTypeOfPaginateFn };
