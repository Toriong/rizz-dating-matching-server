import { DynamicKeyVal } from "./globalInterfaces.js";

interface ICacheKeyVals extends DynamicKeyVal<string[]> { }
type ICache = Partial<ICacheKeyVals>;

export { ICache, ICacheKeyVals }