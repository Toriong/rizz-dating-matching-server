import { Router, Request, Response } from 'express'
import { GLOBAL_VALS } from '../globalVals.js';
import { getReverseGeoLocation } from '../services/globalServices.js';

export const getUserLocationRouter = Router()

getUserLocationRouter.get(`/${GLOBAL_VALS.rejectedUsersRootPath}/get-user-location`, async (request: Request, response: Response) => {
    let { latitude, longitude } = request.query;
    const areValidCoords = (latitude && longitude) && (!isNaN(Number(latitude)) && !isNaN(Number(longitude)))

    if (!areValidCoords) {
        return response.status(400).json({
            msg: 'Invalid coordinates.'
        })
    }

    const coordinatesArr = [latitude, longitude] as unknown as [number, number]
    const userLocationStr = await getReverseGeoLocation(coordinatesArr);

    if(userLocationStr === null){
        return response.status(500).json({
            msg: 'Failed to get the user location.'
        })
    }

    response.status(200).json({ data: userLocationStr })
})

