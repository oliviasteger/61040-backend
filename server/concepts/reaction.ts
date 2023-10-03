import { ObjectId } from "mongodb";
import { BaseDoc } from "../framework/doc";

export interface ReactionDoc extends BaseDoc {
  user: ObjectId;
  target: ObjectId;
  body: string;
}
