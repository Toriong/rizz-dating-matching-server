import { Router, query } from 'express'
import GLOBAL_VALS from '../globalVals.js';
import { deleteRejectedUser } from '../services/rejectedUsersService.js';
import { getParsedBoolStr } from '../helper-fns/routerHelperFns.js';

export const deleteRejectedUserRoute = Router()

deleteRejectedUserRoute.delete(`/${GLOBAL_VALS.rejectedUsersRootPath}/delete-by-doc-id`, async (request, response) => {
    // GOAL: delete a rejected user by way of the id of the document
})

deleteRejectedUserRoute.delete(`/${GLOBAL_VALS.rejectedUsersRootPath}/delete-by-user-id`, async (request, response) => {
    let { userIds, isDeletingByRejectorUserId } = request.query
    isDeletingByRejectorUserId = (typeof isDeletingByRejectorUserId === 'string') ? getParsedBoolStr(isDeletingByRejectorUserId) : isDeletingByRejectorUserId

    if (!userIds || (typeof isDeletingByRejectorUserId !== 'boolean') || (typeof userIds !== 'string')) {
        console.error("Either the userIds is not present or is has an invalid data type or the isDeletingByRejectorUserId is not present or has an invalid data type.")
        return response.status(404).json({ msg: "Requeset failed for either of the following reasons: \n1) The userId is not present. \n2) The userId is an invalid data type. It must be a string. \n3) 'isDeletingByRejectorUserId' must be a boolean." })
    }

    const isMutlipleUserIds = userIds.includes(",")
    userIds = isMutlipleUserIds ? userIds.split(",") : [userIds]
    userIds = userIds.map(userId => userId.trim())
    const queryObj = isDeletingByRejectorUserId ? { rejectorUserId: { $in: userIds } } : { rejectedUserId: { $in: userIds } }
    const result = await deleteRejectedUser(queryObj)

    return response.status(result.status).json({ msg: result.msg })
})
