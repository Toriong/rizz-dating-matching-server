import { UserBaseModelSchema } from "../../models/User.js";
import { IUserAndPrompts } from "../interfaces/promptsInterfaces.js";

type ReturnTypeQueryForMatchesFn = ReturnType<() => ({ potentialMatches: IUserAndPrompts[], userModels: UserBaseModelSchema[] })>
type GetMatchesInfoForClientReturnVal = Promise<ReturnTypeQueryForMatchesFn>
type Sex = 'Female' | 'Male'

export { Sex, GetMatchesInfoForClientReturnVal, ReturnTypeQueryForMatchesFn }
