import NodeCache from "node-cache";
const cache = (() => {
    const _cache = new NodeCache();
    console.log('Cache initialized.');
    return _cache;
})();
// the cache class will do the following: 
// reset the key value pair for cache by passing in the default value for that specific key
class Cache {
    constructor() {
        this.cache = cache;
    }
    updateCache(key, value) {
        this.cache.set(key, value);
    }
    getCacheVal(key) {
        return this.cache.get(key);
    }
    deleteCacheVal(key) {
        this.cache.del(key);
    }
    resetCacheVal(key, valForReset) {
        this.cache.set(key, valForReset);
    }
}
export default cache;
