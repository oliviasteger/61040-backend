import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface CommentDoc extends BaseDoc {
  user: ObjectId;
  target: ObjectId;
  body: string;
}

export default class CommentConcept {
  public readonly comments = new DocCollection<CommentDoc>("comments");

  // Can be used to get comments by user, target, or content.
  async getComments(query: Filter<CommentDoc>) {
    const comments = await this.comments.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return comments;
  }

  async create(user: ObjectId, target: ObjectId, body: string) {
    const _id = await this.comments.createOne({ user, target, body });
    return { msg: "Comment successfully created!", comment: await this.comments.readOne({ _id }) };
  }

  async update(_id: ObjectId, update: Partial<CommentDoc>) {
    this.sanitizeUpdate(update);
    await this.comments.updateOne({ _id }, update);
    return { msg: "Comment successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.comments.deleteOne({ _id });
    return { msg: "Comment deleted successfully!" };
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const comment = await this.comments.readOne({ _id });
    if (!comment) {
      throw new NotFoundError(`Comment ${_id} does not exist!`);
    }
    if (comment.user.toString() !== user.toString()) {
      throw new CommentAuthorNotMatchError(user, _id);
    }
  }

  private sanitizeUpdate(update: Partial<CommentDoc>) {
    // Make sure the update cannot change the user or target.
    const allowedUpdates = ["body"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class CommentAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of comment {1}!", user, _id);
  }
}
