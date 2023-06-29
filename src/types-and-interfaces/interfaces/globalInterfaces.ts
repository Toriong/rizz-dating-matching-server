import { ChatInterface, UserChatIdsInterface } from "./firebaseInterfaces.js";
import { RejectedUserInterface } from "./rejectedUserDocsInterfaces.js"

interface CRUDResult {
    status?: number,
    wasSuccessful: boolean,
    msg?: String,
    data?: RejectedUserInterface | ChatInterface | UserChatIdsInterface | unknown | RejectedUserInterface[] | string[] 
}

export { CRUDResult }