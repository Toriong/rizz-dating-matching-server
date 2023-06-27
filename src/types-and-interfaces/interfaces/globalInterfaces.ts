import { RejectedUserInterface } from "./rejectedUserDocsInterfaces.js"

interface CRUDResult {
    status?: number,
    wasSuccessful: boolean,
    msg?: String,
    data?: RejectedUserInterface | unknown
}

export { CRUDResult }