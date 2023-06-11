import { Router, query } from 'express'
import GLOBAL_VALS from '../globalVals.js';
import { deleteRejectedUser } from '../services/rejectedUsersService.js';

export const deleteRejectedUserRoute = Router()

deleteRejectedUserRoute.delete(`/${GLOBAL_VALS.rootApiPath}/delete-doc-id/:docId`, async (request, response) => {
    // GOAL: delete a rejected user by way of the id of the document
})

deleteRejectedUserRoute.delete(`/${GLOBAL_VALS.rootApiPath}/delete-doc-id/:userIds/:isDeletingByRejectorId`, async (request, response) => {
    const { userIds, isDeletingByRejectorId } = request.params

    if (!userIds || typeof isDeletingByRejectorId !== 'boolean' || typeof userIds !== 'string') {
        return response.status(404).json({ msg: "Requeset failed for eithe of the following reasons: \n1) The userId is not present. \n2) The userId is an invalid data type. It must be a string. \n3) 'isDeletingByRejectorId' must be a boolean." })
    }


    const queryObj = isDeletingByRejectorId ? { rejectorUserId: { $in: [userIds] } } : { rejectedUserId: { $in: [userIds] } }
    const result = await deleteRejectedUser(queryObj)

    return response.status(result.status).json({ msg: result.msg })
})

