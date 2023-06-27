import getFirebaseInfo from "./helper-fns/connectToFirebase.js";
import { CRUDResult } from "../../types-and-interfaces/interfaces/globalInterfaces.js";



async function getChatUser(userId: string): Promise<CRUDResult> {
    try {
        const { db, child, get, ref } = getFirebaseInfo();
        const chatUser = await get(child(ref(db), `1on1Chats/${userId}`))

        return { wasSuccessful: true, data: chatUser.val() }
    } catch(error) {
        console.error(`An error has occurred in getting the chat user from the database, id of user: ${userId}. Error message: `, error)

        return { wasSuccessful: false }
    }
}