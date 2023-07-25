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
    update(key, value) {
        this.cache.set(key, value);
    }
    get(key) {
        return this.cache.get(key);
    }
    delete(key) {
        this.cache.del(key);
    }
    reset(key, valForReset) {
        this.cache.set(key, valForReset);
    }
}
export { cache, Cache };
