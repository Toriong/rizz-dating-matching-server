var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Router } from 'express';
import { getRejectedUsers } from '../services/rejectedUsersService.js';
import GLOBAL_VALS from '../globalVals.js';
export const getRejectedUserRouter = Router();
getRejectedUserRouter.get(`/${GLOBAL_VALS.rejectedUsersRootPath}/get-rejected-users`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    let { userIds, isQueryingByRejectorUserId } = request.query;
    isQueryingByRejectorUserId = ((typeof isQueryingByRejectorUserId === 'string') && ['true', 'false'].includes(isQueryingByRejectorUserId)) ? JSON.parse(isQueryingByRejectorUserId) : isQueryingByRejectorUserId;
    if ((typeof userIds !== 'string') || !userIds || (isQueryingByRejectorUserId === undefined) || (typeof isQueryingByRejectorUserId !== 'boolean')) {
        const errMsg = 'Either the userIds is not present or is has an invalid data type or the isQueryingByRejectorUserId is not present or has an invalid data type.';
        console.error('An error has occurred in getting the rejected users from the database.');
        return response.status(404).json({ msg: errMsg });
    }
    const isMutlipleUserIds = userIds.includes(",");
    userIds = isMutlipleUserIds ? userIds.split(",") : userIds;
    try {
        userIds = Array.isArray(userIds) ? userIds : [userIds];
        console.log('Will get rejected users...');
        const queryObj = isQueryingByRejectorUserId ? { rejectorUserId: { $in: userIds } } : { rejectedUserId: { $in: userIds } };
        const { status, data, msg } = yield getRejectedUsers(queryObj);
        if ((status !== 200) && (typeof msg === 'string')) {
            throw new Error(msg);
        }
        if (status !== 200) {
            throw new Error('An error has occurred in getting the rejected users from the database.');
        }
        return response.status(status).json({ msg: 'The rejected users have been successfully retrieved from the database.', rejectedUsers: data });
    }
    catch (error) {
        const errMsg = `An error has occurred in getting the rejected users from the database. Error message: ${error}`;
        return response.status(500).json({ msg: errMsg });
    }
}));
