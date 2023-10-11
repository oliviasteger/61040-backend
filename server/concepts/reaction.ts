import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ReactionDoc extends BaseDoc {
  user: ObjectId;
  target: ObjectId;
  content: string;
}

export default class ReactionConcept {
  public readonly reactions;

  constructor(targetType: string) {
    this.reactions = new DocCollection<ReactionDoc>("reactions_" + targetType);
  }

  // Can be used to get reactions by user, target, or content.
  async getReactions(query: Filter<ReactionDoc>) {
    const reactions = await this.reactions.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return reactions;
  }

  async create(user: ObjectId, target: ObjectId, content: string) {
    this.isValidReaction(content);
    const _id = await this.reactions.createOne({ user, target, content });
    return { msg: "Reaction successfully created!", reaction: await this.reactions.readOne({ _id }) };
  }

  async update(_id: ObjectId, update: Partial<ReactionDoc>) {
    this.sanitizeUpdate(update);

    if (update.content) {
      this.isValidReaction(update.content);
    }

    await this.reactions.updateOne({ _id }, update);
    return { msg: "Reaction successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.reactions.deleteOne({ _id });
    return { msg: "Reaction deleted successfully!" };
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const reaction = await this.reactions.readOne({ _id });
    if (!reaction) {
      throw new NotFoundError(`Reaction ${_id} does not exist!`);
    }
    if (reaction.user.toString() !== user.toString()) {
      throw new ReactionAuthorNotMatchError(user, _id);
    }
  }

  private sanitizeUpdate(update: Partial<ReactionDoc>) {
    // Make sure the update cannot change the user or target.
    const allowedUpdates = ["content"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }

  private isValidReaction(content: string) {
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    // Check that reaction is a single emoji
    if (content.match(emojiRegex) == null || content.match(emojiRegex)?.length !== 1) {
      throw new NotAllowedError(`Reactions must be a single emoji!`);
    }
  }
}

export class ReactionAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of reaction {1}!", user, _id);
  }
}
