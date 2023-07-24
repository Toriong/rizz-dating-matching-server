import NodeCache from 'node-cache';
import { DynamicKeyVal } from '../types-and-interfaces/interfaces/globalInterfaces.js';

interface ICacheKeyVals {
    userIdsToShowForNextQuery: DynamicKeyVal<string[]> 
}
type ICache = Partial<ICacheKeyVals>;

const cache = new NodeCache();

export { cache, ICache, ICacheKeyVals }