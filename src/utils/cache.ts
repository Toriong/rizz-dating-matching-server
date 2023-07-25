import NodeCache from "node-cache";

const cache = (() => {
    const _cache = new NodeCache();

    console.log('Cache initialized.')

    return _cache;
})();


// the cache class will do the following: 
// reset the key value pair for cache by passing in the default value for that specific key
class Cache {
    cache: NodeCache;

    constructor() {
        this.cache = cache;
    }

    updateCache(key: string, value: any): void {
        this.cache.set(key, value)
    }

    getCacheVal(key: string): unknown {
        return this.cache.get(key);
    }

    deleteCacheVal(key: string): void {
        this.cache.del(key);
    }

    resetCacheVal(key: string, valForReset: [] | unknown): void {
        this.cache.set(key, valForReset);
    }
}

export default cache;