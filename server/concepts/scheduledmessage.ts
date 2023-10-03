import { ObjectId } from "mongodb";
import { BaseDoc } from "../framework/doc";

export interface ScheduledMessageDoc extends BaseDoc {
  user: ObjectId;
  recipients: ObjectId[];
  scheduledTime: number;
  title: string;
  body: string;
}
