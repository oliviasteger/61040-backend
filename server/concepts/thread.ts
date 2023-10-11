import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ThreadDoc extends BaseDoc {
  user: ObjectId;
  target: ObjectId;
  root: ObjectId;
  content: string;
}

export default class ThreadConcept {
  public readonly threads = new DocCollection<ThreadDoc>("threads");

  // Can be used to get threads by user, target, root, or content.
  async getThreads(query: Filter<ThreadDoc>) {
    const threads = await this.threads.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return threads;
  }

  async create(user: ObjectId, target: ObjectId, root: ObjectId, content: string) {
    const _id = await this.threads.createOne({ user, target, root, content });
    return { msg: "Thread successfully created!", thread: await this.threads.readOne({ _id }) };
  }

  async update(_id: ObjectId, update: Partial<ThreadDoc>) {
    this.sanitizeUpdate(update);
    await this.threads.updateOne({ _id }, update);
    return { msg: "Thread successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.threads.deleteOne({ _id });
    return { msg: "Thread deleted successfully!" };
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const thread = await this.threads.readOne({ _id });
    if (!thread) {
      throw new NotFoundError(`Thread ${_id} does not exist!`);
    }
    if (thread.user.toString() !== user.toString()) {
      throw new ThreadAuthorNotMatchError(user, _id);
    }
  }

  async isRootMatch(target: ObjectId, root: ObjectId) {
    const thread = await this.threads.readOne({ _id: target });
    if (!thread) {
      throw new NotFoundError(`Thread ${target} does not exist!`);
    }

    if (thread.root.toString() !== root.toString()) {
      throw new ThreadRootNotMatchError(root, target);
    }
  }

  private sanitizeUpdate(update: Partial<ThreadDoc>) {
    // Make sure the update cannot change the user, root, or target.
    const allowedUpdates = ["content"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class ThreadAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of thread {1}!", user, _id);
  }
}

export class ThreadRootNotMatchError extends NotAllowedError {
  constructor(
    public readonly root: ObjectId,
    public readonly thread: ObjectId,
  ) {
    super("{0} is not root of thread {1}!", root, thread);
  }
}
