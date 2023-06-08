import { Document, Model } from 'mongoose'

export type ModelType = typeof Model   
export type NumberFn = () => number;
export type FnPromiseReturnUnkown = () => Promise<unknown>
export type FnPromiseReturnAny = () => Promise<any>
export type FnPromiseReturnDocument = () => Promise<Document>