import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface ModeratorDoc extends BaseDoc {
  user: ObjectId;
  analyzedText: string;
  flaggedWordCount: number;
}

export default class ModeratorConcept {
  private readonly flags = ["hate", "stupid", "idiot"]; // short list for right now
  private readonly threshold = 2;
  public readonly moderators = new DocCollection<ModeratorDoc>("moderators");

  // Question for OH: how do I implement the sync?
  /*const count = this.flags
      .map((x) => (body.match(`/${x}/g`) || []).length)
      .reduce((a, b) => {
        return a + b;
    }, 0);*/
}
