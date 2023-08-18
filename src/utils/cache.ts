import NodeCache from "node-cache";

const cache = (() => {
    const _cache = new NodeCache();

    console.log('Cache initialized.')

    return _cache;
})();

class Cache {
    cache: NodeCache;

    constructor() {
        this.cache = cache;
    }

    set(key: string, value: any, expirationMs: number): void {
        if(expirationMs !== undefined){
            this.cache.set(key, value, expirationMs)
            return;
        }

        this.cache.set(key, value)
    }

    get(key: string): unknown {
        return this.cache.get(key);
    }

    delete(key: string): void {
        this.cache.del(key);
    }
}

export { cache, Cache };