import AnnouncementConcept from "./concepts/announcement";
import FriendConcept from "./concepts/friend";
import ModeratorConcept from "./concepts/moderator";
import PostConcept from "./concepts/post";
import ProfileConcept from "./concepts/profile";
import ReactionConcept from "./concepts/reaction";
import RecapConcept from "./concepts/recap";
import ScheduledMessageConcept from "./concepts/scheduledmessage";
import ThreadConcept from "./concepts/thread";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const Announcement = new AnnouncementConcept();
export const Friend = new FriendConcept();
export const Moderator = new ModeratorConcept();
export const Post = new PostConcept();
export const Profile = new ProfileConcept();
export const ReactionOnPost = new ReactionConcept("post");
export const ReactionOnThread = new ReactionConcept("thread");
export const Recap = new RecapConcept();
export const ScheduledMessage = new ScheduledMessageConcept();
export const Thread = new ThreadConcept();
export const User = new UserConcept();
export const WebSession = new WebSessionConcept();
