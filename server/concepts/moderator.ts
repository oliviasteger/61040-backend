import { ObjectId } from "mongodb";
import Sentiment from "sentiment";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ModeratorDoc extends BaseDoc {
  user: ObjectId;
  content: string;
  score: number;
}

export default class ModeratorConcept {
  public readonly moderators = new DocCollection<ModeratorDoc>("moderators");
  private readonly sentiment = new Sentiment();

  async create(user: ObjectId, content: string) {
    const analysis = this.sentiment.analyze(content);
    return { msg: "Moderator created successfully!", moderator: await this.moderators.createOne({ user: user, content: content, score: analysis.comparative }) };
  }

  async isSentimentNegative(_id: ObjectId) {
    const moderator = await this.moderators.readOne({ _id });
    if (moderator === null) {
      throw new NotFoundError(`Moderator not found!`);
    }

    if (moderator.score < 0) {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      const count = (await this.moderators.readMany({ $and: [{ score: { $lt: 0 } }, { dateCreated: { $gte: date } }] })).length;
      throw new NegativeSentimentError(moderator.score, count);
    }
  }
}

export class NegativeSentimentError extends NotAllowedError {
  constructor(
    public readonly sentiment: number,
    public readonly count: number,
  ) {
    super("Your text had a negative sentiment score of {0}. You have had {1} negative reactions this week. Maybe it's time to log off.", sentiment, count);
  }
}
