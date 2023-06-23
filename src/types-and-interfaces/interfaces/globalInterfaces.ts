import { RejectedUserInterface } from "./rejectedUserDocsInterfaces.js"

interface CRUDResult {
    status: number,
    msg?: String,
    data?: RejectedUserInterface | unknown
}

export { CRUDResult }