
function getParsedBoolStr(queryBoolStr: string): string {
  return ((typeof queryBoolStr === 'string') && ['true', 'false'].includes(queryBoolStr)) ? JSON.parse(queryBoolStr) : queryBoolStr
}


export { getParsedBoolStr }
