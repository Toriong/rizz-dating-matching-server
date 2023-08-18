import NodeCache from "node-cache";
const cache = (() => {
    const _cache = new NodeCache();
    console.log('Cache initialized.');
    return _cache;
})();
class Cache {
    constructor() {
        this.cache = cache;
    }
    set(key, value, expirationMs) {
        if (expirationMs !== undefined) {
            this.cache.set(key, value, expirationMs);
            return;
        }
        this.cache.set(key, value);
    }
    get(key) {
        return this.cache.get(key);
    }
    delete(key) {
        this.cache.del(key);
    }
}
export { cache, Cache };
