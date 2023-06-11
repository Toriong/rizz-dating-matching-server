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
import GLOBAL_VALS from '../globalVals.js';
export const getRejectedUserRouter = Router();
getRejectedUserRouter.get(`/${GLOBAL_VALS.rootApiPath}/get-rejected-users`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    response.send('Server is up and running! Hey there, fuck you!');
    // const { userId } = request.query;
    // if ((typeof userId !== 'string') || !userId) {
    //     return response.status(404).json({ msg: 'The id of the user is either not present in the request object or has an invalid data type.' })
    // }
    // try {
    //     const rejectedUsers = await getRejectedUsers(userId)
    //     return response.status(200).json({ msg: 'The rejected users have been successfully retrieved from the database.', rejectedUsers: rejectedUsers })
    // } catch (error) {
    //     const errMsg = `An error has occurred in getting the rejected users from the database. Error message: ${error}`
    //     return response.status(500).json({ msg: errMsg })
    // }
}));
