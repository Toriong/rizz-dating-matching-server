var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Router } from 'express';
import { GLOBAL_VALS } from '../globalVals.js';
import { getReverseGeoLocation } from '../services/globalServices.js';
export const getUserLocationRouter = Router();
getUserLocationRouter.get(`/${GLOBAL_VALS.rejectedUsersRootPath}/get-user-location`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    let { latitude, longitude } = request.query;
    const areValidCoords = (latitude && longitude) && (!isNaN(Number(latitude)) && !isNaN(Number(longitude)));
    if (!areValidCoords) {
        return response.status(400).json({
            msg: 'Invalid coordinates.'
        });
    }
    const coordinatesArr = [latitude, longitude];
    const userLocationStr = yield getReverseGeoLocation(coordinatesArr);
    if (userLocationStr === null) {
        return response.status(500).json({
            msg: 'Failed to get the user location.'
        });
    }
    response.status(200).json({ data: userLocationStr });
}));
