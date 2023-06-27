import { Router, Request, Response } from 'express'
import { insertRejectedUser } from "../services/rejectingUsers/rejectedUsersService.js";
import GLOBAL_VALS from '../globalVals.js';
import { RejectedUserInterface } from '../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js';

export const insertRouter = Router();

insertRouter.post(`/${GLOBAL_VALS.rejectedUsersRootPath}/insert-rejected-users`, async (request: Request, response: Response) => {
    const { rejectedUserId, rejectorUserId, reason } = request.body ?? {}

    if (!rejectedUserId || !rejectorUserId) {
        console.error('Either the rejectedUserId or the rejectorUserId was not provided in the request body.')
        return response.status(404).json({ 
            devMsg: "The ids of the rejector and the rejected must be provided.", 
            clientMsg: "Something went wrong. We've tracked the user whom you rejected. Please try again. If the error persist, please reset the app. You can find the users that were failed to be rejected in your messages tab." 
        })
    }

    const rejectedUser: RejectedUserInterface = { rejectedUserId: rejectedUserId, rejectorUserId: rejectorUserId, reason: reason || null }

    try {
        const insertionPromiseResult = await insertRejectedUser(rejectedUser)
        const { status, msg } = insertionPromiseResult;

        if ((status === 500) && (typeof msg === 'string')) {
            return response.status(status).json({ 
                devMsg: msg, 
                clientMsg: "Something went wrong. We've tracked the user whom you rejected. Please try again. If the error persist, please reset the app. You can find the users that were failed to be rejected in your messages tab." 
            })
        }

        return response.status(200).json({ devMsg: "The rejected user has been successfully inserted into the database." })
    } catch (error) {
        console.error('An error has occurred in inserting the rejected user into the database: ', error)

        return response.status(500).json({ devMsg: `Failed to insert the rejected user into the db. Error message ${error}.` })
    }
})
