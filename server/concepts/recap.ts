import { ObjectId } from "mongodb";
import { BaseDoc } from "../framework/doc";

export interface RecapDoc extends BaseDoc {
  user: ObjectId;
  numContent: number;
  numComment: number;
  numReaction: number;
  mostInteractedWith: ObjectId[];
  leastInteractedWith: ObjectId[];
}
