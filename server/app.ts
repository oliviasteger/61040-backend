import AnnouncementConcept from "./concepts/announcement";
import CommentConcept from "./concepts/comment";
import FriendConcept from "./concepts/friend";
import PostConcept from "./concepts/post";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Friend = new FriendConcept();
export const Announcement = new AnnouncementConcept();
export const Comment = new CommentConcept();
