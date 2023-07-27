var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { User as Users } from '../models/User.js';
import { getLocationStr } from './matching/matchesQueryServices.js';
function getUserById(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return Users.findById(userId).lean();
    });
}
function getUsersByIds(userIds) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return Users.find({ _id: { $in: userIds } }).lean();
        }
        catch (error) {
            console.error('An error has occurred in getUsersByIds: ', error);
            return [];
        }
    });
}
function getUsersByDynamicField(queryObj) {
    return __awaiter(this, void 0, void 0, function* () {
        return Users.find(queryObj);
    });
}
function getReverseGeoLocation(userLocationCoords) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data, wasSuccessful } = yield getLocationStr(userLocationCoords);
            if (!data || !wasSuccessful) {
                throw new Error("Failed to get the reverse geo location for user.");
            }
            return data;
        }
        catch (error) {
            console.error('An error has occurred in getting the reverse geo location for the user.');
            return null;
        }
    });
}
export { getUserById, getUsersByIds, getUsersByDynamicField, getReverseGeoLocation };
