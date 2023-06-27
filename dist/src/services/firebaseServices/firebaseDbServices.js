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
function getChatUserById(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { db, child, get, ref } = getFirebaseInfo();
            const chatUserDataSnapShot = yield get(child(ref(db), `userChatIds/${userId}`));
            if (!chatUserDataSnapShot.exists()) {
                throw new Error('The chat user does not exist in the firebase db.');
            }
            return { wasSuccessful: true, data: chatUserDataSnapShot.val() };
        }
        catch (error) {
            console.error(`An error has occurred in getting the chat user from the database, id of user: ${userId}. Error message: `, error);
            return { wasSuccessful: false };
        }
    });
}
// GOAL: get the chat from the firebase db
// the chat is received
// query the db in the followign format: `1on1Chats/${chatId}`
// the id of the chat is passed in as an argument for getChatUser
function getChatById(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { db, child, get, ref } = getFirebaseInfo();
            const chatDataSnapShot = yield get(child(ref(db), `1on1Chats/${chatId}`));
            if (!chatDataSnapShot.exists()) {
                throw new Error('The chat does not exist in the firebase db.');
            }
            return { wasSuccessful: true, data: chatDataSnapShot.val() };
        }
        catch (error) {
            const errorMsg = `An error has occurred in getting the chat from the database. Error message: ${error}`;
            return { wasSuccessful: false, msg: errorMsg };
        }
    });
}
