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

    update(key: string, value: any): void {
        this.cache.set(key, value)
    }

    get(key: string): unknown {
        return this.cache.get(key);
    }

    delete(key: string): void {
        this.cache.del(key);
    }

    reset(key: string, valForReset: [] | unknown): void {
        this.cache.set(key, valForReset);
    }
}

export { cache, Cache };