import Mongoose, { Document, Model } from 'mongoose';
import { mongoosePagination } from "mongoose-paginate-ts";
import { UserLocation } from '../types-and-interfaces/interfaces/userQueryInterfaces.js';

type Sex = 'Male' | 'Female' | 'female' | 'male'
type SortObjVal = 'asc' | 'ascending' | 'desc' | 'descending' | 1 | -1;
type KeysForPaginationQuerying = Pick<UserBaseModelSchema, "sex">;
type GeometryObjType = "Point";
interface GeometryObj {
    type: GeometryObjType,
    coordinates: [number, number]
}
interface PaginationQueryingOpts extends KeysForPaginationQuerying {
    location?: {
        $near: {
            $geometry: GeometryObj,
            $maxDistance: number,
            $minDistance?: number
        }
    },
    birthDate?: { $gt: Date, $lt: Date }
}
type SelectType = { [KeyName in keyof UserBaseModelSchema]: 0 | 1 }
interface UserBaseModelSchema {
    _id: String,
    name: UserNames,
    password: String,
    birthDate: {
        type: Date,
        required: boolean
    },
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
interface SortObj {
    ratingNum: SortObjVal
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
interface PaginationArgsOpts {
    query: PaginationQueryingOpts,
    sort: SortObj,
    select?: SelectType,
    page: number,
    limit: number
}
type PaginateFn = (paginationArgsOpts: PaginationArgsOpts) => Promise<ReturnTypeOfPaginateFn>;
interface PaginatedModel extends Mongoose.Model<Document> {
    paginate: PaginateFn
}

const { Schema, models, model } = Mongoose;

const UserNames = new Schema<UserNames>({
    first: String,
    last: String,
    nickName: String
}, { _id: false })
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
const UserSchema = new Schema<UserBaseModelSchema>({
    _id: String,
    name: UserNames,
    password: String,
    birthDate: {
        type: Date,
        required: true
    },
    location: UserLocation,
    bio: String,
    hobbies: [String],
    email: String,
    phoneNum: Number,
    ratingNum: Number,
}, { timestamps: true })

UserSchema.index({ location: '2dsphere' })

UserSchema.plugin(mongoosePagination)

const User = model('users', UserSchema);



export { User, PaginatedModel, ReturnTypeOfPaginateFn, PaginationQueryingOpts, PaginationArgsOpts };
