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
const router = Router();
// delete the rejected user from the database for the following reasons:
// when the user deletes their account, delete all documents that has the id of the user in the field of rejectorUserId
// when the user manually deletes the rejected user from the database
router.route('/rejected-user').delete((request, response) => __awaiter(void 0, void 0, void 0, function* () {
}));
export default router;
