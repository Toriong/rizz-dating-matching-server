import { RejectedUser } from '../models/RejectedUser.js';
import { CRUDResult, RejectedUserInterface } from '../types-and-interfaces/interfaces.js';
import { FnPromiseReturnDocument, ModelType } from '../types-and-interfaces/types.js';

// BRAIN DUMP:
// this file will handle the following services:

// 1. store the rejected user into the database
// 2. will delete the rejected user from the database

// this function will insert the rejected user into the database 
// will return an object of the result:
// the status
// the error message, if present

// as the parameter: will get the id of the rejector, the id of the rejected user, and the reason for rejection

// CASE: the rejection of user was not successful, it failed to insert into the database
// return a 500 error with the error message
// the check fails
// check if the user was inserted into the database


// CASE: the rejection of user was successful, it was inserted into the database 
// it was successful 
// check if the inseration was successful
// the user is inserted into the databse
// will use RejectedUser model to insert the user into the database
// a new Schema of RejectedUser is instantiated with the following values: id of the rejector,
// id of the rejected, and the reason for the rejection (if present)
// the above values are created as an object and is passed as an parameter for insertRejectedUser function
interface CustomModel extends ModelType {
    save: FnPromiseReturnDocument
}




async function insertRejectedUser(rejectedUserDocument: RejectedUserInterface): Promise<CRUDResult> {
    try {
        const newRejectedUser: CustomModel = new RejectedUser({ ...rejectedUserDocument })
        const rejectedUserSaveResult = await newRejectedUser.save()

        rejectedUserSaveResult.validateSync()

        return { status: 200 }
    } catch (error) {
        const errMsg = `An error has occurred in rejectedUsersService.ts: insertRejectedUser(). Error message: ${error}`

        console.error(errMsg)

        return { status: 500, msg: errMsg }
    }
}

async function deleteRejectedUser(rejectedUserDocument: RejectedUserInterface): Promise<CRUDResult | void>  {
}

export { insertRejectedUser }