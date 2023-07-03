import { ChatInterface, UserChatIdsInterface } from "./firebaseInterfaces.js";
import { PromptInterface } from "./promptsInterfaces.js";
import { RejectedUserInterface } from "./rejectedUserDocsInterfaces.js"

interface CRUDResult {
    status?: number,
    wasSuccessful: boolean,
    msg?: String,
    data?: RejectedUserInterface | ChatInterface | UserChatIdsInterface | unknown | RejectedUserInterface[] | string[] | PromptInterface  
}

export { CRUDResult }