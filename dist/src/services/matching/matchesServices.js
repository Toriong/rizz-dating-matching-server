var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getMatches(currentUserLocation) {
    return __awaiter(this, void 0, void 0, function* () {
        // GOAL #1: perform pagination of the users collection based on the following criteria:
        // the location of the user (location.longitude, location.latitude)
        // the age of the user (birthDate)
        // the sex of the user
        // get only the highest rated users (user.ratingNum)
        const paginationOptions = {};
        // const potentialMatches = (User as PaginatedModel).paginate()
        // GOAL #2: check if the result users have been either:
        // rejected by the current user (the user on the client side)
        // or has rejected the current user  
        // GOAL #3: Send the users to the client. 
    });
}
export { getMatches };
