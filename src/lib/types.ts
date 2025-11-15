// Lightweight Timestamp type to support both Firestore-like objects and plain dates/strings.
export type Timestamp = { toDate?: () => Date } | string | Date;

export type UserProfile = {
  id: string; // The document ID
  uid: string; // The auth UID
  name: string;
  email: string;
  avatar: {
    url: string;
    hint: string;
  };
  bio: string;
};

export type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    sellerId: string;
    image: {
        url: string;
        hint: string;
    };
    createdAt: Timestamp;
};

export type Post = {
  id: string;
  authorId: string;
  content: string;
  image?: { url: string; hint: string };
  createdAt: Timestamp;
  likes: number;
  likedBy: string[];
  comments: number;
};

export type LostFoundItem = {
  id: string;
  type: 'lost' | 'found';
  name: string;
  description: string;
  location: string;
  contact: string;
  userId: string;
  image: { url: string; hint: string };
  createdAt: Timestamp;
};

export type Conversation = {
  id: string;
  participantIds: string[];
  participants: { [key: string]: UserProfile };
  lastMessageText?: string;
  lastMessageAt?: Timestamp;
};

export type Message = {
  id: string;
  text: string;
  createdAt: Timestamp;
  senderId: string;
  file?: {
    url: string;
    path?: string;
    mime?: string;
  };
};
