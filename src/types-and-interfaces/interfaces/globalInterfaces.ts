import { ChatInterface, UserChatIdsInterface } from "./firebaseValsInterfaces.js";
import { RejectedUserInterface } from "./rejectedUserDocsInterfaces.js"

interface CRUDResult {
    status?: number,
    wasSuccessful: boolean,
    msg?: String,
    data?: RejectedUserInterface | ChatInterface | UserChatIdsInterface | unknown | RejectedUserInterface[]
}

export { CRUDResult }