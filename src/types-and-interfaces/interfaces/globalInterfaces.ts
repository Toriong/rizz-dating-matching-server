import { ChatInterface, UserChatIdsInterface } from "./firebaseInterfaces.js";
import { PromptInterface, PromptModelInterface } from "./promptsInterfaces.js";
import { RejectedUserInterface } from "./rejectedUserDocsInterfaces.js"

interface CRUDResult {
    status?: number,
    wasSuccessful: boolean,
    msg?: String,
    data?: RejectedUserInterface | ChatInterface | UserChatIdsInterface | unknown
    | RejectedUserInterface[] | string[] | PromptInterface | PromptInterface[] | PromptModelInterface[]
}
type DynamicKeyVal<TData> = { [key: string | symbol]: TData }
type IError = {
    didErrorOccur?: boolean
    msg?: boolean
}

export { CRUDResult, IError, DynamicKeyVal }