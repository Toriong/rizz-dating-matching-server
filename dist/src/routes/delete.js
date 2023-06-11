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
import { deleteRejectedUser } from '../services/rejectedUsersService.js';
const router = Router();
router.delete(`/${GLOBAL_VALS.rootApiPath}/delete-doc-id/:docId`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    // GOAL: delete a rejected user by way of the id of the document
}));
router.delete(`/${GLOBAL_VALS.rootApiPath}/delete-doc-id/:userIds/:isDeletingByRejectorId`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const { userIds, isDeletingByRejectorId } = request.params;
    if (!userIds || typeof isDeletingByRejectorId !== 'boolean' || typeof userIds !== 'string') {
        return response.status(404).json({ msg: "Requeset failed for eithe of the following reasons: \n1) The userId is not present. \n2) The userId is an invalid data type. It must be a string. \n3) 'isDeletingByRejectorId' must be a boolean." });
    }
    const queryObj = isDeletingByRejectorId ? { rejectorUserId: { $in: [userIds] } } : { rejectedUserId: { $in: [userIds] } };
    const result = yield deleteRejectedUser(queryObj);
    return response.status(result.status).json({ msg: result.msg });
}));
export default router;
