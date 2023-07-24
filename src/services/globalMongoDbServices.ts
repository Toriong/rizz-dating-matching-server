import { UserBaseModelSchema, User as Users } from '../models/User.js';

async function getUserById(userId: string): Promise<UserBaseModelSchema | null> {
    return Users.findById(userId).lean()
}

async function getUsersByIds(userIds: string[]): Promise<UserBaseModelSchema[]> {
    try {
        return Users.find({ _id: { $in: userIds } }).lean()
    } catch (error) {
        console.error('An error has occurred in getUsersByIds: ', error)
        return [];
    }
}

async function getUsersByDynamicField(queryObj: UserBaseModelSchema): Promise<any> {
    return Users.find(queryObj)
}


export { getUserById, getUsersByIds, getUsersByDynamicField }