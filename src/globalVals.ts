const GLOBAL_VALS = {
    rejectedUsersRootPath: 'rejected-users',
    matchesRootPath: 'matches'
} as const;

const EXPIRATION_TIME_CACHED_MATCHES = 864_000 // 24 hours in seconds

export { GLOBAL_VALS, EXPIRATION_TIME_CACHED_MATCHES };