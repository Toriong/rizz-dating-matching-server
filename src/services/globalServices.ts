import { UserBaseModelSchema, User as Users } from '../models/User.js';
import { getLocationStr } from './matching/matchesQueryServices.js';

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

async function getReverseGeoLocation(userLocationCoords: [number, number]): Promise<string | null> {
    try {
        const { data, wasSuccessful } = await getLocationStr(userLocationCoords);

        if(!data || !wasSuccessful){
            throw new Error("Failed to get the reverse geo location for user.")
        }

        return data;
    } catch (error) {
        console.error('An error has occurred in getting the reverse geo location for the user.');

        return null
    }
}

export { getUserById, getUsersByIds, getUsersByDynamicField, getReverseGeoLocation  }
