import { Router, Request, Response } from 'express'
import { getRejectedUsers } from '../services/rejectedUsersService.js';
import GLOBAL_VALS from '../globalVals.js';

export const getRejectedUserRouter = Router()

getRejectedUserRouter.get(`/${GLOBAL_VALS.rootApiPath}/get-rejected-users`, async (request: Request, response: Response) => {
    let { userIds, isQueryingByRejectorUserId } = request.query;
    isQueryingByRejectorUserId = ((typeof isQueryingByRejectorUserId === 'string') && ['true', 'false'].includes(isQueryingByRejectorUserId)) ? JSON.parse(isQueryingByRejectorUserId) : isQueryingByRejectorUserId 

    if ((typeof userIds !== 'string') || !userIds || (isQueryingByRejectorUserId === undefined) || (typeof isQueryingByRejectorUserId !== 'boolean')) {
        const errMsg = 'Either the userIds is not present or is has an invalid data type or the isQueryingByRejectorUserId is not present or has an invalid data type.'
        console.error('An error has occurred in getting the rejected users from the database.')

        return response.status(404).json({ msg: errMsg })
    }

    const isMutlipleUserIds = userIds.includes(",")
    userIds = isMutlipleUserIds ? userIds.split(",") : userIds

    try {
        userIds = Array.isArray(userIds) ? userIds : [userIds]
        console.log('Will get rejected users...')
        const queryObj = isQueryingByRejectorUserId ? { rejectorUserId: { $in: userIds } } : { rejectedUserId: { $in: userIds } }
        const { status, data, msg } = await getRejectedUsers(queryObj);

        if((status !== 200) && (typeof msg === 'string')){
            throw new Error(msg)
        }

        if(status !== 200){
            throw new Error('An error has occurred in getting the rejected users from the database.')
        }

        return response.status(status).json({ msg: 'The rejected users have been successfully retrieved from the database.', rejectedUsers: data })
    } catch (error) {
        const errMsg = `An error has occurred in getting the rejected users from the database. Error message: ${error}`

        return response.status(500).json({ msg: errMsg })
    }
})

