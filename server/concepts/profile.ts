import { ObjectId } from "mongodb";
import { BaseDoc } from "../framework/doc";

export interface ProfileDoc extends BaseDoc {
  user: ObjectId;
  name: string;
  details: string;
}
