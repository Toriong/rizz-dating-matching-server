var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getMatches() {
    return __awaiter(this, void 0, void 0, function* () {
        // GOAL: perform pagination of the users collection based on the following criteria:
        // the location of the user (location.longitude, location.latitude)
        // the age of the user (birthDate)
        // the sex of the user
        // Sort the users by their rating. 
    });
}
export { getMatches };
