import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ProfileDoc extends BaseDoc {
  user: ObjectId;
  name: string;
  details: string;
}

export default class ProfileConcept {
  public readonly profiles = new DocCollection<ProfileDoc>("profiles");

  async create(user: ObjectId) {
    return { msg: "Profile succesfully created!", profile: this.profiles.createOne({ user: user, name: "", details: "" }) };
  }

  async update(user: ObjectId, update: Partial<ProfileDoc>) {
    this.sanitizeUpdate(update);
    await this.profiles.updateOne({ user }, update);
    return { msg: "Profile successfully updated!" };
  }

  async getProfileByUser(user: ObjectId) {
    const profile = await this.profiles.readOne({ user });
    if (!profile) {
      throw new NotFoundError(`Profile for ${user} does not exist!`);
    }

    return profile;
  }

  private sanitizeUpdate(update: Partial<ProfileDoc>) {
    // Make sure the update cannot change the user.
    const allowedUpdates = ["name", "details"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}
