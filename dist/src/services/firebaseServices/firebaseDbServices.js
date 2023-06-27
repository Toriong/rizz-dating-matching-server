var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import getFirebaseInfo from "./helper-fns/connectToFirebase.js";
function getChatUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { db, child, get, ref } = getFirebaseInfo();
            const chatUser = yield get(child(ref(db), `1on1Chats/${userId}`));
            return { wasSuccessful: true, data: chatUser.val() };
        }
        catch (error) {
            console.error(`An error has occurred in getting the chat user from the database, id of user: ${userId}. Error message: `, error);
            return { wasSuccessful: false };
        }
    });
}
