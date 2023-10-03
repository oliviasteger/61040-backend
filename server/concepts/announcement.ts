import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface AnnouncementDoc extends BaseDoc {
  user: ObjectId;
  body: string;
}

export default class AnnouncementConcept {
  public readonly announcements = new DocCollection<AnnouncementDoc>("announcements");

  async getAnnouncementsByUser(user: ObjectId) {
    return await this.announcements.readMany({ user: user }, { sort: { dateUpdated: -1 } });
  }

  async create(user: ObjectId, body: string) {
    return await { msg: "Announcement successfully created!", announcement: this.announcements.createOne({ user: user, body: body }) };
  }
}
