import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Announcement, Comment, Friend, Post, User, WebSession } from "./app";
import { CommentDoc } from "./concepts/comment";
import { PostDoc, PostOptions } from "./concepts/post";
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
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    return await User.create(username, password);
    // Should also create a profile for the user with blank name and bio
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
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
    // run moderator before posting
  }

  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
    // run moderator before posting
  }

  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return Post.delete(_id);
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
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
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

  @Router.get("/comments")
  async getComments(user?: string, target?: string) {
    const query = {};

    if (user) {
      const id = (await User.getUserByUsername(user))._id;
      Object.assign(query, { user: id });
    }

    if (target) {
      Object.assign(query, { target });
    }

    return await Comment.getComments(query);
  }

  @Router.post("/comments")
  async createComment(session: WebSessionDoc, target: ObjectId, body: string) {
    const user = WebSession.getUser(session);
    return await Comment.create(user, target, body);
    // run moderator before posting
  }

  @Router.patch("/comments/:_id")
  async updateComment(session: WebSessionDoc, _id: ObjectId, update: Partial<CommentDoc>) {
    const user = WebSession.getUser(session);
    await Comment.isAuthor(user, _id);
    return await Comment.update(_id, update);
    // run moderator before posting
  }

  @Router.delete("/comments/:_id")
  async deleteComment(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Comment.isAuthor(user, _id);
    return Comment.delete(_id);
  }

  @Router.get("/moderators/")
  async getModerators(/*session: WebSessionDoc*/) {
    /**
     * const user = WebSession.getUser(session);
       return await Moderator.getModeratorsByUser(user); */
  }

  @Router.post("/moderators/")
  async createModerator(/*session: WebSessionDoc, text: string*/) {
    /** 
     * const user = WebSession.getUser(session);
       return await Moderator.create(user, text);
    */
  }

  @Router.get("/profiles/")
  async getProfile(/*session: WebSessionDoc, name: string*/) {
    /**
     * const user = WebSession.getUser(session);
     * get profileUser = user profile associated with name
     * check that user is friends with the user profile they are trying to view or is the user profile
     * if yes, await Profile.getProfileByUser(profileUser)
     * otherwise throw error
     */
  }

  @Router.patch("/profiles/")
  async updateProfile(/*session: WebSessionDoc, update: Partial<ProfileDoc>*/) {
    /**
     * const user = WebSession.getUser(session);
     * check that user owns the profile they are trying to update
     * Profile.update(user, Partial<ProfileDoc>)
     */
  }

  @Router.get("/reactions/")
  async getReactions(/* session: WebSessionDoc, user?: string, target?: string*/) {
    /**
     * create new filter by user or by target
     * search reactions
     */
  }

  @Router.post("/reactions/")
  async createReaction(/* session: WebSessionDoc, target: ObjectId, body: string*/) {
    /**
     * create new reaction with target and body, check that body is an emoji
     */
  }

  @Router.patch("/reactions/:_id")
  async updateReaction(/* session: WebSessionDoc, _id: ObjectId, update: Partial<ReactionDoc>*/) {
    /**
     * check that user is author of reaction
     * allow them to update with the update object
     */
  }

  @Router.delete("/reactions/:_id")
  async deleteReaction(/* session: WebSessionDoc, _id: ObjectId */) {
    /**
     * check that user is author of reaction
     * allow them to delete the reaction with id _id
     */
  }

  @Router.get("/recaps/")
  async getRecaps(/* session: WebSessionDoc */) {
    /**
     * const user = WebSession.getUser(session);
     * return await Recap.getRecapsByUser(user);
     */
  }

  @Router.post("/recaps/")
  async createRecap(/* session: WebSessionDoc */) {
    /**
     * const user = WebSession.getUser(session);
     * interactions: User → one Number
     * numContent, numComment, numReaction: one Number
     * Iterate through friends in friendships, and initialize interactions[friend] to 0
     * Iterate through content in Content.getContentByAuthor(user) where the date is in the past month, and
     * increment interactions[friend] for each tagged friend, and increment numContent
     * Iterate through comments in Comment.getCommentByAuthor(user) where the date is in the past month, and
     * increment numComment, get the associated artifact's author, and increment interactions[author] by one
     * Iterate through reactions in Reaction.getReactionByAuthor(user) where the date is in the past month, and
     * increment numReaction, get the associated artifact's author, and increment interactions[author] by one
     * mostInteractedWith = users in interactions with the highest 3 numbers
     * leastInteractedWith = users in interactions with the lowest 3 numbers
     */
  }

  @Router.get("/scheduledmessages/")
  async getScheduledMessages(/* session: WebSessionDoc */) {
    // get all scheduled messages sent by user or where recipient is user and scheduledTime is before Date.now()
  }

  @Router.post("/scheduledmessages/")
  async createScheduledMessage(/* session: WebSessionDoc, recipients: string[], scheduledTime: number, title: string, body: string;*/) {
    // get all user ids from usernames in recipients, check that they are all friends
    // check that scheduledTime is in the future
    // create new scheduled message using recipients, scheduledTime, title, body
  }
}

export default getExpressRouter(new Routes());
