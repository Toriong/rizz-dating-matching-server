var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { RejectedUser } from '../models/RejectedUser.js';
function insertRejectedUser(rejectedUserDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const newRejectedUser = new RejectedUser(Object.assign({}, rejectedUserDocument));
            const rejectedUserSaveResult = yield newRejectedUser.save();
            rejectedUserSaveResult.validateSync();
            return { status: 200 };
        }
        catch (error) {
            const errMsg = `An error has occurred in rejectedUsersService.ts: insertRejectedUser(). Error message: ${error}`;
            console.error(errMsg);
            return { status: 500, msg: errMsg };
        }
    });
}
function deleteRejectedUser(rejectedUserDocument) {
    return __awaiter(this, void 0, void 0, function* () {
    });
}
function getRejectedUsers(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rejectedUsers = yield RejectedUser.find({ rejectorUserId: userId });
            return { status: 200, data: rejectedUsers };
        }
        catch (error) {
            console.error('An error ha occurred in getting  the rejected users from the database. Error message: ', error);
            return { status: 500, msg: 'An error ha occurred in getting  the rejected users from the database. Error message: ' + error };
        }
    });
}
export { insertRejectedUser, getRejectedUsers };
