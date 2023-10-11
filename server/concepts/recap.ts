import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface RecapDoc extends BaseDoc {
  user: ObjectId;
  numPost: number;
  numThread: number;
  numReaction: number;
  mostInteractedWith: ObjectId[];
  leastInteractedWith: ObjectId[];
}

export default class RecapConcept {
  public readonly recaps = new DocCollection<RecapDoc>("recaps");

  async create(user: ObjectId, numPost: number, numThread: number, numReaction: number, mostInteractedWith: ObjectId[], leastInteractedWith: ObjectId[]) {
    const _id = await this.recaps.createOne({ user, numPost, numThread, numReaction, mostInteractedWith, leastInteractedWith });
    return { msg: "Recap successfully created!", recap: await this.recaps.readOne({ _id }) };
  }

  async getRecaps(user: ObjectId) {
    return await this.recaps.readMany(
      { user },
      {
        sort: { dateUpdated: -1 },
      },
    );
  }
}
