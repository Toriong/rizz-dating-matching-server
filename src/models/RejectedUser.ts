import mongoose from 'mongoose';

const { Schema, Model, Document }  = mongoose;
type DateFunction = () => number;

interface ExpireAtSchema extends Schema<any> {
  type: Date;
  default: DateFunction;
}

interface RejectedUserDocument extends Document {
  _id: string;
  rejectedUserId: string;
  reason: string;
  expireAt: ExpireAtSchema;
}

interface MongooseModels {
  rejectedUsers: mongoose.Model<RejectedUserDocument>;
}

const models: MongooseModels = mongoose.models;

    


// GOAL #1: create a test that will add the rejected user to the RejectedUsers collection 

// GOAL #2: write the code that will store the user into the database

// GOAL #3: create a function that will send the id of the rejected user and the time (current time in miliseconds + 10 days in miliseconds) in which the user document will expire 



const MILISECONDS_IN_A_DAY = 86400000;

const ExpireAtSchema = new mongoose.Schema({
    type: Date,
    default: () => Date.now() + (MILISECONDS_IN_A_DAY * 10)
})

const RejectedUser = new mongoose.Schema({
    // the id will be the user id of the rejector 
    _id: String,
    rejectedUserId: String,
    reason: String,
    expireAt: ExpireAtSchema

}, { timestamps: true })
