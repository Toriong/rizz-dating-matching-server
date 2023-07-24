import NodeCache from "node-cache";

const cache = (() => {
    console.log('creating cache')
    const _cache = new NodeCache();
    return _cache;
})();

export default cache;