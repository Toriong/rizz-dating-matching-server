var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { RejectedUser as RejectedUsers } from '../../models/RejectedUser.js';
function insertRejectedUser(rejectedUserDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const newRejectedUser = new RejectedUsers(Object.assign({}, rejectedUserDocument));
            const rejectedUserSaveResult = yield newRejectedUser.save();
            rejectedUserSaveResult.validateSync();
            console.log('A new document was inserted into the db.');
            return { wasSuccessful: true, status: 200 };
        }
        catch (error) {
            const errMsg = `An error has occurred in rejectedUsersService.ts: insertRejectedUser(). Error message: ${error}`;
            console.error(errMsg);
            return { wasSuccessful: false, status: 500, msg: errMsg };
        }
    });
}
function deleteRejectedUser(queryObj) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const results = yield RejectedUsers.deleteMany(queryObj);
            return { wasSuccessful: true, status: 200, msg: `Number of rejectedUsers documents that were deleted: ${results.deletedCount}` };
        }
        catch (error) {
            console.error('An error has occurred in deleting the rejected user from the database. Error message: ', error);
            return { wasSuccessful: false, status: 500, msg: "An error has occurred in deleting the rejectedUsers from database." };
        }
    });
}
function getRejectedUsers(queryObj) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rejectedUsers = yield RejectedUsers.find(queryObj).lean();
            return { wasSuccessful: true, status: 200, data: rejectedUsers };
        }
        catch (error) {
            console.error('An error ha occurred in getting  the rejected users from the database. Error message: ', error);
            return { wasSuccessful: false, status: 500, msg: 'An error ha occurred in getting  the rejected users from the database. Error message: ' + error };
        }
    });
}
export { insertRejectedUser, getRejectedUsers, deleteRejectedUser };
