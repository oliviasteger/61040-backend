import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Announcement, Friend, Moderator, Post, Profile, ReactionOnPost, ReactionOnThread, Recap, ScheduledMessage, Thread, User, WebSession } from "./app";
import { PostDoc } from "./concepts/post";
import { ProfileDoc } from "./concepts/profile";
import { ReactionDoc } from "./concepts/reaction";
import { Content, ScheduledMessageDoc } from "./concepts/scheduledmessage";
import { ThreadDoc } from "./concepts/thread";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

class Routes {
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }

  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string, phone: string) {
    WebSession.isLoggedOut(session);
    const user = await User.create(username, password, phone);
    if (user.user) {
      await Profile.create(user.user?._id);
    }
    return user;
  }

  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }

  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    return await User.delete(user);
  }

  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  async getPosts(session: WebSessionDoc, author?: string) {
    const user = WebSession.getUser(session);
    const friends = await Friend.getFriends(user);

    let posts;

    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      if (id.toString() !== user.toString()) await Friend.verifyFriends(user, id);
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({ author: { $in: friends } });
    }

    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string, image: string, tagged: string[]) {
    const user = WebSession.getUser(session);
    await Post.isValidContent(content, image);

    // Run moderator before allowing post
    if (content) {
      const moderatorId = (await Moderator.create(user, content)).moderator;
      await Moderator.isSentimentNegative(moderatorId);
    }
    // Check if tagged users are friends, and update to ObjectId
    const taggedIds: ObjectId[] = [];

    for (const username of tagged) {
      const usernameId = (await User.getUserByUsername(username))._id;
      if (usernameId.toString() !== user.toString()) await Friend.verifyFriends(user, usernameId);
      taggedIds.push((await User.getUserByUsername(username))._id);
    }

    const created = await Post.create(user, taggedIds, content, image);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<Omit<PostDoc, "tagged"> & { tagged: string[] }>) {
    const user = WebSession.getUser(session);
    if (update.content || update.image) await Post.isValidContent(update.content, update.image);
    await Post.isAuthor(user, _id);

    const updateModified: Partial<PostDoc> = {};

    // Run moderator before allowing update
    if (update.content) {
      const moderatorId = (await Moderator.create(user, update.content)).moderator;
      await Moderator.isSentimentNegative(moderatorId);

      updateModified.content = update.content;
    }

    // Check if tagged users are friends, and update to ObjectId
    const taggedIds: ObjectId[] = [];
    if (update.tagged) {
      for (const username of update.tagged) {
        const usernameId = (await User.getUserByUsername(username))._id;
        if (usernameId.toString() !== user.toString()) await Friend.verifyFriends(user, usernameId);
        taggedIds.push((await User.getUserByUsername(username))._id);
      }

      updateModified.tagged = taggedIds;
    }

    if (update.image) updateModified.image = update.image;

    return await Post.update(_id, updateModified);
  }

  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return Post.delete(_id);
  }

  @Router.get("/threads")
  async getThreads(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Thread.getThreads({ user });
  }

  @Router.get("/posts/:_root/threads")
  async getThreadsOfPost(session: WebSessionDoc, _root: ObjectId) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, _root);
    return Thread.getThreads({ $and: [{ target: _root }, { root: _root }] });
  }

  @Router.get("/threads/:_target/threads")
  async getThreadsOfThread(session: WebSessionDoc, _target: ObjectId) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, await getRootId(_target));
    return Thread.getThreads({ target: _target });
  }

  @Router.post("/posts/:_root/threads")
  async createThread(session: WebSessionDoc, _root: ObjectId, content: string, target?: ObjectId) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, _root);

    // Check that target root is the same as the root
    if (target) await Thread.isRootMatch(target, _root);

    // Run Moderator before allowing thread
    const moderatorId = (await Moderator.create(user, content)).moderator;
    await Moderator.isSentimentNegative(moderatorId);

    return await Thread.create(user, target ? target : _root, _root, content);
  }

  @Router.patch("/threads/:_id")
  async updateThread(session: WebSessionDoc, _id: ObjectId, update: Partial<ThreadDoc>) {
    const user = WebSession.getUser(session);
    await Thread.isAuthor(user, _id);
    await verifyPosterFriendship(user, await getRootId(_id));

    // Run Moderator before allowing update
    if (update.content) {
      const moderatorId = (await Moderator.create(user, update.content)).moderator;
      await Moderator.isSentimentNegative(moderatorId);
    }

    return await Thread.update(_id, update);
  }

  @Router.delete("/threads/:_id")
  async deleteThread(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Thread.isAuthor(user, _id);
    return await Thread.delete(_id);
  }

  @Router.get("/reactions")
  async getReactions(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const reactionsOnPosts = await ReactionOnPost.getReactions({ user });
    const reactionsOnThreads = await ReactionOnThread.getReactions({ user });
    return reactionsOnPosts.concat(reactionsOnThreads);
  }

  @Router.get("/posts/:_target/reactions")
  async getReactionsByPost(session: WebSessionDoc, _target: ObjectId) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, _target);
    return await ReactionOnPost.getReactions({ target: _target });
  }

  @Router.get("/threads/:_target/reactions")
  async getReactionsByThread(session: WebSessionDoc, _target: ObjectId) {
    const user = WebSession.getUser(session);

    const thread = (await Thread.getThreads({ _id: _target }))[0];
    await verifyPosterFriendship(user, thread.root);

    return await ReactionOnThread.getReactions({ target: _target });
  }

  @Router.post("/posts/:_target/reactions")
  async createReactionOnPost(session: WebSessionDoc, _target: ObjectId, content: string) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, _target);
    return await ReactionOnPost.create(user, _target, content);
  }

  @Router.post("/threads/:_target/reactions")
  async createReactionOnThread(session: WebSessionDoc, _target: ObjectId, content: string) {
    const user = WebSession.getUser(session);

    const thread = (await Thread.getThreads({ _id: _target }))[0];
    await verifyPosterFriendship(user, thread.root);

    return await ReactionOnThread.create(user, _target, content);
  }

  @Router.patch("/posts/:_target/reactions/:_id")
  async updateReactionOnPost(session: WebSessionDoc, _target: ObjectId, _id: ObjectId, update: Partial<ReactionDoc>) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, _target);
    await ReactionOnPost.isAuthor(user, _id);
    return await ReactionOnPost.update(_id, update);
  }

  @Router.patch("/threads/:_target/reactions/:_id")
  async updateReactionOnThread(session: WebSessionDoc, _target: ObjectId, _id: ObjectId, update: Partial<ReactionDoc>) {
    const user = WebSession.getUser(session);
    const thread = (await Thread.getThreads({ _id: _target }))[0];
    await verifyPosterFriendship(user, thread.root);
    await ReactionOnThread.isAuthor(user, _id);
    return await ReactionOnThread.update(_id, update);
  }

  @Router.delete("/posts/:_target/reactions:_id")
  async deleteReactionOnPost(session: WebSessionDoc, _target: ObjectId, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await verifyPosterFriendship(user, _target);
    await ReactionOnPost.isAuthor(user, _id);
    return await ReactionOnPost.delete(_id);
  }

  @Router.delete("/threads/:_target/reactions:_id")
  async deleteReactionOnThread(session: WebSessionDoc, _target: ObjectId, _id: ObjectId) {
    const user = WebSession.getUser(session);
    const thread = (await Thread.getThreads({ _id: _target }))[0];
    await verifyPosterFriendship(user, thread.root);
    await ReactionOnThread.isAuthor(user, _id);
    return await ReactionOnThread.delete(_id);
  }

  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await Friend.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Friend.removeFriend(user, friendId);
  }

  @Router.get("/friend/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.friendRequests(await Friend.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string, phone: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    await User.isValidLineNumber(toId, phone);
    return await Friend.sendRequest(user, toId);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.removeRequest(user, toId);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.acceptRequest(fromId, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.rejectRequest(fromId, user);
  }

  @Router.get("/announcements/")
  async getAnnouncements(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Announcement.getAnnouncementsByUser(user);
  }

  @Router.post("/announcements/")
  async createAnnouncement(session: WebSessionDoc, body: string) {
    const user = WebSession.getUser(session);
    return await Announcement.create(user, body);
  }

  @Router.patch("/profiles")
  async updateProfile(session: WebSessionDoc, update: Partial<ProfileDoc>) {
    const user = WebSession.getUser(session);
    return await Profile.update(user, update);
  }

  @Router.get("/profiles")
  async getProfile(session: WebSessionDoc, owner?: string) {
    const id = owner ? (await User.getUserByUsername(owner))._id : WebSession.getUser(session);
    return await Profile.getProfileByUser(id);
  }

  @Router.get("/recaps/")
  async getRecaps(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Recap.getRecaps(user);
  }

  @Router.post("/recaps/")
  async createRecap(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const interactions: Map<string, number> = new Map();
    let numPost = 0;
    let numThread = 0;
    let numReaction = 0;
    const date = new Date();
    date.setMonth(date.getMonth() - 1);

    for (const friend of await Friend.getFriends(user)) {
      interactions.set(friend.toString(), 0);
    }

    // Get tagged users in content
    for (const content of await Post.posts.readMany({ author: user, dateCreated: { $gte: date } })) {
      for (const tag of content.tagged) {
        const interactionsSum = interactions.get(tag.toString());
        interactions.set(tag.toString(), interactionsSum ? interactionsSum + 1 : 1);
      }

      numPost += 1;
    }

    // Get authors of thread targets
    for (const thread of await Thread.threads.readMany({ user, dateCreated: { $gte: date } })) {
      const targetAuthor = (await Thread.threads.readOne({ _id: thread.target }))?.user || (await Post.posts.readOne({ _id: thread.target }))?.author;
      if (targetAuthor == null) continue;

      const interactionsSum = interactions.get(targetAuthor.toString());
      interactions.set(targetAuthor.toString(), interactionsSum ? interactionsSum + 1 : 1);

      numThread += 1;
    }

    // Get authors of posts reacted to
    for (const reaction of await ReactionOnPost.getReactions({ user, dateCreated: { $gte: date } })) {
      const targetAuthor = (await Post.getPosts({ _id: reaction.target }))[0].author;
      const interactionsSum = interactions.get(targetAuthor.toString());
      interactions.set(targetAuthor.toString(), interactionsSum ? interactionsSum + 1 : 1);

      numReaction += 1;
    }

    // Get authors of threads reacted to
    for (const reaction of await ReactionOnThread.getReactions({ user, dateCreated: { $gte: date } })) {
      const targetAuthor = (await Thread.getThreads({ _id: reaction.target }))[0].user;
      const interactionsSum = interactions.get(targetAuthor.toString());
      interactions.set(targetAuthor.toString(), interactionsSum ? interactionsSum + 1 : 1);

      numReaction += 1;
    }

    // Order interactions by most interacted to least interacted with
    const interactionsDescending = [...interactions.entries()]
      .sort((x, y) => y[1] - x[1])
      .map((x) => new ObjectId(x[0]))
      .filter((x) => x.toString() != user.id.toString());
    const numSlots = Math.min(3, interactionsDescending.length % 2 == 0 ? interactionsDescending.length / 2 : (interactionsDescending.length - 1) / 2);

    return await Recap.create(user, numPost, numThread, numReaction, interactionsDescending.slice(0, numSlots), interactionsDescending.slice(-1 * numSlots));
  }

  @Router.get("/scheduledmessages/received")
  async getScheduledMessagesByRecipient(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const date = Date.now();
    return await ScheduledMessage.getScheduledMessagesByRecipient(user, date);
  }

  @Router.get("/scheduledmessages/sent")
  async getScheduledMessagesBySender(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await ScheduledMessage.getScheduledMessagesBySender(user);
  }

  @Router.post("/scheduledmessages/")
  async createScheduledMessage(session: WebSessionDoc, recipients: string[], scheduledTime: string, title: string, content: Content[]) {
    const user = WebSession.getUser(session);

    const recipientIds = [];

    for (const username of recipients) {
      const usernameId = (await User.getUserByUsername(username))._id;
      if (usernameId.toString() !== user.toString()) await Friend.verifyFriends(user, usernameId);
      recipientIds.push((await User.getUserByUsername(username))._id);
    }

    await ScheduledMessage.isValidScheduledTime(Number(scheduledTime));
    await ScheduledMessage.isValidContent(content);

    return await ScheduledMessage.create(user, recipientIds, Number(scheduledTime), title, content);
  }

  @Router.patch("/scheduledmessages/:_id")
  async updateScheduledMessage(session: WebSessionDoc, _id: ObjectId, update: Partial<Omit<ScheduledMessageDoc, "recipients"> & { recipients: string[] }>) {
    const user = WebSession.getUser(session);
    await ScheduledMessage.isAuthor(user, _id);

    // Don't allow updates if message has been sent
    await ScheduledMessage.isMessageSent(_id);

    const updateModified: Partial<ScheduledMessageDoc> = {};

    if (update.content) {
      await ScheduledMessage.isValidContent(update.content);
      updateModified.content = update.content;
    }

    if (update.scheduledTime) {
      await ScheduledMessage.isValidScheduledTime(Number(update.scheduledTime));
      updateModified.scheduledTime = Number(update.scheduledTime);
    }

    const recipientIds = [];

    if (update.recipients) {
      for (const username of update.recipients) {
        const usernameId = (await User.getUserByUsername(username))._id;
        if (usernameId.toString() !== user.toString()) await Friend.verifyFriends(user, usernameId);
        recipientIds.push((await User.getUserByUsername(username))._id);
      }

      updateModified.recipients = recipientIds;
    }

    if (update.title) updateModified.title = update.title;

    return await ScheduledMessage.update(_id, updateModified);
  }

  @Router.delete("/scheduledmessages/:_id")
  async deleteScheduledMessage(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await ScheduledMessage.isAuthor(user, _id);
    return ScheduledMessage.delete(_id);
  }
}

async function verifyPosterFriendship(user: ObjectId, id: ObjectId) {
  // Can only react if the post was made by a friend
  const post = (await Post.getPosts({ _id: id }))[0];
  if (post.author.toString() !== user.toString()) await Friend.verifyFriends(post.author, user);
}

async function getRootId(id: ObjectId) {
  return (await Thread.getThreads({ _id: id }))[0].root;
}

export default getExpressRouter(new Routes());
