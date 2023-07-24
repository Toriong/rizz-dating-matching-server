import { DynamicKeyVal } from "./globalInterfaces.js";

interface ICacheKeyVals {
    userIdsToShowForNextQuery: DynamicKeyVal<string[]> 
}
type ICache = Partial<ICacheKeyVals>;

export { ICache, ICacheKeyVals }