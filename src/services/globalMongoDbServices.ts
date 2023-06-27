import { UserBaseModelSchema, User as Users } from '../models/User.js';

async function getUserById(userId: string): Promise<any>{
    return Users.findById(userId).lean()
}

async function getUsersByIds(userIds: string[]): Promise<any>{
    return Users.find({ _id: { $in: userIds } })
}

async function getUsersByDynamicField(queryObj: UserBaseModelSchema): Promise<any>{
    return Users.find(queryObj)
}


export { getUserById, getUsersByIds, getUsersByDynamicField }