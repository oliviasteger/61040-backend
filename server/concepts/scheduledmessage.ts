import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface Content {
  content?: string;
  imageUrl?: string;
}

export interface ScheduledMessageDoc extends BaseDoc {
  user: ObjectId;
  recipients: ObjectId[];
  scheduledTime: number;
  title: string;
  content: Content[];
}

export default class ScheduledMessageConcept {
  public readonly scheduledMessages = new DocCollection<ScheduledMessageDoc>("scheduledMessages");

  async create(user: ObjectId, recipients: ObjectId[], scheduledTime: number, title: string, content: Content[]) {
    return { msg: "ScheduledMessage successfully created!", scheduledMessage: await this.scheduledMessages.createOne({ user, recipients, scheduledTime, title, content }) };
  }
  async update(_id: ObjectId, update: Partial<ScheduledMessageDoc>) {
    this.sanitizeUpdate(update);
    await this.scheduledMessages.updateOne({ _id }, update);
    return { msg: "Scheduled Message successfully updated!" };
  }

  async getScheduledMessagesBySender(user: ObjectId) {
    return await this.scheduledMessages.readMany(
      { user },
      {
        sort: { dateUpdated: -1 },
      },
    );
  }

  async getScheduledMessagesByRecipient(user: ObjectId, date: number) {
    return await this.scheduledMessages.readMany(
      { $and: [{ recipients: user }, { scheduledTime: { $lte: date } }] },
      {
        sort: { dateUpdated: -1 },
      },
    );
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const scheduledMessage = await this.scheduledMessages.readOne({ _id });
    if (!scheduledMessage) {
      throw new NotFoundError(`ScheduledMessage ${_id} does not exist!`);
    }
    if (scheduledMessage.user.toString() !== user.toString()) {
      throw new ScheduledMessageAuthorNotMatchError(user, _id);
    }
  }

  async isValidScheduledTime(scheduledTime: number) {
    if (scheduledTime < Date.now()) throw new ScheduledTimeBeforeNowError(scheduledTime);
  }

  async isMessageSent(_id: ObjectId) {
    const scheduledMessage = await this.scheduledMessages.readOne({ _id });
    if (!scheduledMessage) {
      throw new NotFoundError(`ScheduledMessage ${_id} does not exist!`);
    }
    if (scheduledMessage.scheduledTime < Date.now()) {
      throw new NotAllowedError(`ScheduledMessage ${_id} has already been sent!`);
    }
  }

  async isValidContent(content: Content[]) {
    for (const item of content) {
      if (!item.content && !item.imageUrl) {
        throw new NotAllowedError(`Cannot create a ScheduledMessage with no content!`);
      } else if (item.content && item.imageUrl) {
        throw new NotAllowedError(`Cannot create a ScheduledMessage with text and image content!`);
      }
    }
  }

  private sanitizeUpdate(update: Partial<ScheduledMessageDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["recipients", "scheduledTime", "title", "content"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }

  async delete(_id: ObjectId) {
    await this.scheduledMessages.deleteOne({ _id });
    return { msg: "ScheduledMessage deleted successfully!" };
  }
}

export class ScheduledMessageAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of ScheduledMessage {1}!", author, _id);
  }
}

export class ScheduledTimeBeforeNowError extends NotAllowedError {
  constructor(public readonly date: number) {
    super("{0} is before the current time.", date);
  }
}
