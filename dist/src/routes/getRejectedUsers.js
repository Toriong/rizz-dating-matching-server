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
getRejectedUserRouter.get(`/${GLOBAL_VALS.rootApiPath}/get-rejected-users/:userIds/:isQueryingByRejectorUserId`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const { userIds, isQueryingByRejectorUserId } = request.query;
    if ((typeof userIds !== 'string') || !userIds || (isQueryingByRejectorUserId === undefined) || (typeof isQueryingByRejectorUserId !== 'boolean')) {
        const errMsg = 'Either the userIds is not present or is has an invalid data type or the isQueryingByRejectorUserId is not present or has an invalid data type.';
        return response.status(404).json({ msg: errMsg });
    }
    try {
        const queryObj = isQueryingByRejectorUserId ? { rejectorUserId: { $in: [userIds] } } : { rejectedUserId: { $in: [userIds] } };
        const rejectedUsers = yield getRejectedUsers(queryObj);
        return response.status(200).json({ msg: 'The rejected users have been successfully retrieved from the database.', rejectedUsers: rejectedUsers });
    }
    catch (error) {
        const errMsg = `An error has occurred in getting the rejected users from the database. Error message: ${error}`;
        return response.status(500).json({ msg: errMsg });
    }
}));
