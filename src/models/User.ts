import Mongoose, { Document, Model } from 'mongoose';
import { mongoosePagination } from "mongoose-paginate-ts";

type Sex = 'Male' | 'Female' | 'female' | 'male'
type SortObjVal = 'asc' | 'ascending' | 'desc' | 'descending' | 1 | -1;
type KeysForPaginationQuerying = Pick<UserBaseModelSchema, "sexAttraction" | "sex" | "hasPrompts">;
type GeometryObjType = "Point";
interface GeometryObj {
    type: GeometryObjType,
    coordinates: [number, number]
}
interface PaginationQueryingOpts extends Partial<KeysForPaginationQuerying> {
    // don't show users by their id given an array of user ids, the ids will be strings
    _id?: { $nin: string[] },
    location?: {
        $near: {
            $geometry: GeometryObj,
            $maxDistance: number,
            $minDistance?: number
        }
    },
    birthDate?: { $gt: Date, $lt: Date }
}
interface UserNames {
    first: string,
    last: string,
    nickName?: string
}
interface SortObj {
    ratingNum: SortObjVal
}
interface Picture {
    isMatching: boolean,
    picFileNameOnAws: string
}
interface Look{
    // example: 'eyes'
    bodyPart: string,
    // example: 'brown'
    description: string
}
type UserLocationTypeStr = "Point"
interface UserLocation {
    type: UserLocationTypeStr,
    // [longitude, latitude]
    coordinates: [number, number]
}
interface UserBaseModelSchema {
    _id: string,
    name: UserNames,
    sexAttraction: string,
    password: string,
    birthDate: {
        type: Date,
        required: boolean
    },
    sex: Sex,
    location: UserLocation,
    bio?: string,
    pics: Picture[],
    hobbies?: [string],
    email: string,
    phoneNum: number,
    hasPrompts: boolean,
    ratingNum: number,
    looks?: Look[]
}
type TProjection = { [KeyName in keyof UserBaseModelSchema]: 0 | 1 }
interface PaginationArgsOpts {
    query: PaginationQueryingOpts,
    sort: SortObj,
    select?: TProjection,
    page: number,
    limit: number
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
type PaginateFn = (paginationArgsOpts: PaginationArgsOpts) => Promise<ReturnTypeOfPaginateFn>;
interface PaginatedModel extends Mongoose.Model<Document> {
    paginate: PaginateFn
}

const { Schema, model } = Mongoose;
const UserNames = new Schema<UserNames>({
    first: String,
    last: String,
    nickName: String
}, { _id: false })
const UserLocation = new Schema<UserLocation>({
    type: {
        type: String,
        enum: ['Point'],
        required: true
    },
    coordinates: {
        type: [Number, Number],
        required: true
    }
});
const PictureSchema = new Schema<Picture>({
    isMatching: Boolean,
    picFileNameOnAws: String
})
const UserSchema = new Schema<UserBaseModelSchema>({
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
    hasPrompts: Boolean
}, { timestamps: true })

UserSchema.index({ location: '2dsphere' })

UserSchema.plugin(mongoosePagination)

const User = model('users', UserSchema);

export { User, PaginatedModel, ReturnTypeOfPaginateFn, PaginationQueryingOpts, PaginationArgsOpts, UserBaseModelSchema, Picture, UserNames, UserLocation, TProjection };
