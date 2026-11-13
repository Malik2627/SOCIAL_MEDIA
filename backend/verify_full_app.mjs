import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

// Import Backend Routes and Middleware
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { initSocketServer, getIO, emitToUser, isUserOnline } from './socket/socketServer.js';
import {
  securityHeaders,
  generalLimiter,
  sanitizeNoSql,
  getAllowedOrigins,
} from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { hashPassword, comparePassword } from './utils/password.js';

// Import Models
import User from './models/User.js';
import Post from './models/Post.js';
import Comment from './models/Comment.js';
import Notification from './models/Notification.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';

// Import Socket.io Client for real-time testing
const socketClientUrl = 'file:///D:/Socialmedia/frontend/node_modules/socket.io-client/build/esm/index.js';
const { io: ioClient } = await import(socketClientUrl);

process.env.JWT_SECRET = 'full-app-test-jwt-secret-key-12345';
process.env.NODE_ENV = 'test';

console.log('====================================================');
console.log('STARTING STEP 19 COMPREHENSIVE END-TO-END TEST SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// In-Memory Database Simulation
// ----------------------------------------------------
const db = {
  users: {},
  posts: {},
  comments: {},
  notifications: {},
  conversations: {},
  messages: {},
};

let idCounter = 1000;
function nextId() {
  idCounter++;
  return `60d5ec49f1b2c82b8c8a${idCounter}`;
}

// User Model Mocks
User.create = async function (data) {
  const _id = nextId();
  const doc = {
    _id,
    name: data.name,
    username: data.username,
    email: data.email,
    password: data.password,
    profilePicture: data.profilePicture || '',
    profilePicturePublicId: data.profilePicturePublicId || '',
    bio: data.bio || '',
    followers: data.followers || [],
    following: data.following || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    save: async function () {
      db.users[_id] = { ...this };
      return this;
    },
  };
  db.users[_id] = doc;
  return doc;
};

User.findById = function (id) {
  const uid = (id?._id || id)?.toString();
  const u = db.users[uid];
  if (!u) {
    return {
      select: () => Promise.resolve(null),
      then: (r, e) => Promise.resolve(null).then(r, e),
    };
  }
  const copy = { ...u };
  copy.save = async function () {
    db.users[uid] = { ...this };
    return this;
  };
  return {
    select: (fields) => {
      if (typeof fields === 'string' && fields.includes('+password')) {
        copy.password = u.password;
      }
      return Promise.resolve(copy);
    },
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
};

User.findOne = function (query) {
  let found = null;
  if (query?.email) {
    found = Object.values(db.users).find((u) => u.email.toLowerCase() === query.email.toLowerCase());
  } else if (query?.username) {
    found = Object.values(db.users).find((u) => {
      let match = false;
      if (query.username instanceof RegExp) {
        match = query.username.test(u.username);
      } else if (typeof query.username === 'string') {
        match = u.username.toLowerCase() === query.username.toLowerCase();
      }
      if (!match) return false;
      if (query._id?.$ne && u._id.toString() === query._id.$ne.toString()) return false;
      return true;
    });
  }
  if (!found) {
    return {
      select: () => Promise.resolve(null),
      then: (r, e) => Promise.resolve(null).then(r, e),
    };
  }
  const copy = { ...found };
  copy.save = async function () {
    db.users[copy._id] = { ...this };
    return this;
  };
  return {
    select: (fields) => {
      if (typeof fields === 'string' && fields.includes('+password')) {
        copy.password = found.password;
      }
      return Promise.resolve(copy);
    },
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
};

User.find = function (query) {
  let list = Object.values(db.users);
  if (query?._id?.$in) {
    const ids = query._id.$in.map((i) => i.toString());
    list = list.filter((u) => ids.includes(u._id.toString()));
  }
  if (query?.$or) {
    list = list.filter((u) => {
      return query.$or.some((cond) => {
        if (cond.username instanceof RegExp) return cond.username.test(u.username);
        if (cond.name instanceof RegExp) return cond.name.test(u.name);
        if (cond.username?.$regex) return cond.username.$regex.test(u.username);
        if (cond.name?.$regex) return cond.name.$regex.test(u.name);
        return false;
      });
    });
  }
  const q = {
    select: () => q,
    limit: (n) => {
      list = list.slice(0, n);
      return q;
    },
    then: (r, e) => Promise.resolve(list).then(r, e),
  };
  return q;
};

User.findByIdAndUpdate = function (id, updates, options) {
  const uid = (id?._id || id)?.toString();
  const u = db.users[uid];
  if (!u) {
    return {
      select: () => Promise.resolve(null),
      then: (r, e) => Promise.resolve(null).then(r, e),
    };
  }

  if (updates?.$addToSet) {
    if (updates.$addToSet.followers) {
      const fid = updates.$addToSet.followers.toString();
      if (!u.followers.some((i) => (i?._id || i).toString() === fid)) {
        u.followers.push(updates.$addToSet.followers);
      }
    }
    if (updates.$addToSet.following) {
      const fid = updates.$addToSet.following.toString();
      if (!u.following.some((i) => (i?._id || i).toString() === fid)) {
        u.following.push(updates.$addToSet.following);
      }
    }
  }

  if (updates?.$pull) {
    if (updates.$pull.followers) {
      const fid = updates.$pull.followers.toString();
      u.followers = u.followers.filter((i) => (i?._id || i).toString() !== fid);
    }
    if (updates.$pull.following) {
      const fid = updates.$pull.following.toString();
      u.following = u.following.filter((i) => (i?._id || i).toString() !== fid);
    }
  }

  for (const [k, v] of Object.entries(updates)) {
    if (!k.startsWith('$')) {
      u[k] = v;
    }
  }

  u.updatedAt = new Date().toISOString();
  const copy = { ...u };
  return {
    select: () => Promise.resolve(copy),
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
};

User.findByIdAndDelete = async function (id) {
  const uid = (id?._id || id)?.toString();
  const u = db.users[uid];
  delete db.users[uid];
  return u;
};

User.updateMany = async function (filter, update) {
  let count = 0;
  for (const u of Object.values(db.users)) {
    if (update?.$pull) {
      if (update.$pull.followers) {
        const pullId = update.$pull.followers.toString();
        u.followers = u.followers.filter((i) => (i?._id || i).toString() !== pullId);
      }
      if (update.$pull.following) {
        const pullId = update.$pull.following.toString();
        u.following = u.following.filter((i) => (i?._id || i).toString() !== pullId);
      }
    }
    count++;
  }
  return { acknowledged: true, modifiedCount: count };
};

// Post Model Mocks
Post.create = async function (data) {
  const _id = nextId();
  const doc = {
    _id,
    author: data.author,
    content: data.content || '',
    image: data.image || '',
    imagePublicId: data.imagePublicId || '',
    likes: data.likes || [],
    comments: data.comments || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    async save() {
      db.posts[_id] = { ...this };
      return this;
    },
    populate(field) {
      if (field === 'author') {
        const a = db.users[(this.author?._id || this.author).toString()];
        this.author = a ? { _id: a._id, name: a.name, username: a.username, profilePicture: a.profilePicture } : this.author;
      }
      return Promise.resolve(this);
    },
  };
  db.posts[_id] = doc;
  return doc;
};

Post.findById = function (id) {
  const pid = (id?._id || id)?.toString();
  const p = db.posts[pid];
  if (!p) {
    return {
      populate: () => Promise.resolve(null),
      then: (r, e) => Promise.resolve(null).then(r, e),
    };
  }
  const copy = { ...p };
  copy.save = async function () {
    db.posts[pid] = { ...this };
    return this;
  };
  const q = {
    populate: (field) => {
      if (field === 'author') {
        const a = db.users[(copy.author?._id || copy.author).toString()];
        copy.author = a ? { _id: a._id, name: a.name, username: a.username, profilePicture: a.profilePicture } : copy.author;
      }
      return q;
    },
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
  return q;
};

Post.find = function (query) {
  let list = Object.values(db.posts);
  if (query?.author) {
    const aid = (query.author?._id || query.author).toString();
    list = list.filter((p) => (p.author?._id || p.author).toString() === aid);
  }
  const q = {
    sort: () => q,
    populate: (field) => {
      list.forEach((p) => {
        if (field === 'author') {
          const a = db.users[(p.author?._id || p.author).toString()];
          p.author = a ? { _id: a._id, name: a.name, username: a.username, profilePicture: a.profilePicture } : p.author;
        }
      });
      return q;
    },
    then: (r, e) => Promise.resolve(list).then(r, e),
  };
  return q;
};

Post.findByIdAndUpdate = function (id, update, options) {
  const pid = (id?._id || id)?.toString();
  const p = db.posts[pid];
  if (!p) {
    return {
      select: () => Promise.resolve(null),
      then: (r, e) => Promise.resolve(null).then(r, e),
    };
  }
  if (update?.$pull?.comments) {
    const cid = (update.$pull.comments?._id || update.$pull.comments).toString();
    p.comments = p.comments.filter((i) => (i?._id || i).toString() !== cid);
  }
  if (update?.$pull?.likes) {
    const lid = (update.$pull.likes?._id || update.$pull.likes).toString();
    p.likes = p.likes.filter((i) => (i?._id || i).toString() !== lid);
  }
  return {
    select: () => Promise.resolve(p),
    then: (r, e) => Promise.resolve(p).then(r, e),
  };
};

Post.findByIdAndDelete = async function (id) {
  const pid = (id?._id || id)?.toString();
  const p = db.posts[pid];
  delete db.posts[pid];
  return p;
};

Post.deleteMany = async function (query) {
  let count = 0;
  const aid = (query?.author?._id || query?.author)?.toString();
  for (const [id, p] of Object.entries(db.posts)) {
    if (aid && (p.author?._id || p.author).toString() === aid) {
      delete db.posts[id];
      count++;
    }
  }
  return { acknowledged: true, deletedCount: count };
};

Post.updateMany = async function (filter, update) {
  let count = 0;
  for (const p of Object.values(db.posts)) {
    if (update?.$pull?.likes) {
      const lid = (update.$pull.likes?._id || update.$pull.likes).toString();
      p.likes = p.likes.filter((i) => (i?._id || i).toString() !== lid);
    }
    if (update?.$pull?.comments) {
      const cid = (update.$pull.comments?._id || update.$pull.comments).toString();
      p.comments = p.comments.filter((i) => (i?._id || i).toString() !== cid);
    }
    count++;
  }
  return { acknowledged: true, modifiedCount: count };
};

// Comment Model Mocks
Comment.create = async function (data) {
  const _id = nextId();
  const doc = {
    _id,
    post: data.post,
    author: data.author,
    content: data.content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    async save() {
      db.comments[_id] = { ...this };
      return this;
    },
    async deleteOne() {
      delete db.comments[_id];
      return this;
    },
    populate(field) {
      if (field === 'author') {
        const a = db.users[(this.author?._id || this.author).toString()];
        this.author = a ? { _id: a._id, name: a.name, username: a.username, profilePicture: a.profilePicture } : this.author;
      }
      return Promise.resolve(this);
    },
  };
  db.comments[_id] = doc;
  return doc;
};

Comment.findById = function (id) {
  const cid = (id?._id || id)?.toString();
  const c = db.comments[cid];
  if (!c) {
    return {
      populate: () => Promise.resolve(null),
      then: (r, e) => Promise.resolve(null).then(r, e),
    };
  }
  const copy = { ...c };
  copy.save = async function () {
    db.comments[cid] = { ...this };
    return this;
  };
  copy.deleteOne = async function () {
    delete db.comments[cid];
    return copy;
  };
  const q = {
    populate: (field) => {
      if (field === 'author') {
        const a = db.users[(copy.author?._id || copy.author).toString()];
        copy.author = a ? { _id: a._id, name: a.name, username: a.username, profilePicture: a.profilePicture } : copy.author;
      }
      return q;
    },
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
  return q;
};

Comment.find = function (query) {
  let list = Object.values(db.comments);
  if (query?.post) {
    const pid = (query.post?._id || query.post).toString();
    list = list.filter((c) => (c.post?._id || c.post).toString() === pid);
  }
  const q = {
    sort: () => q,
    populate: (field) => {
      list.forEach((c) => {
        if (field === 'author') {
          const a = db.users[(c.author?._id || c.author).toString()];
          c.author = a ? { _id: a._id, name: a.name, username: a.username, profilePicture: a.profilePicture } : c.author;
        }
      });
      return q;
    },
    then: (r, e) => Promise.resolve(list).then(r, e),
  };
  return q;
};

Comment.findByIdAndDelete = async function (id) {
  const cid = (id?._id || id)?.toString();
  const c = db.comments[cid];
  delete db.comments[cid];
  return c;
};

Comment.deleteMany = async function (query) {
  let count = 0;
  for (const [id, c] of Object.entries(db.comments)) {
    let match = false;
    if (query?.$or) {
      for (const cond of query.$or) {
        if (cond.author && (c.author?._id || c.author).toString() === cond.author.toString()) match = true;
        if (cond.post?.$in && cond.post.$in.some((pid) => pid.toString() === (c.post?._id || c.post).toString())) match = true;
      }
    } else if (query?.post && (c.post?._id || c.post).toString() === query.post.toString()) {
      match = true;
    }
    if (match) {
      delete db.comments[id];
      count++;
    }
  }
  return { acknowledged: true, deletedCount: count };
};

// Notification Model Mocks
Notification.create = async function (data) {
  const _id = nextId();
  const doc = {
    _id,
    recipient: data.recipient,
    sender: data.sender,
    type: data.type,
    post: data.post || null,
    comment: data.comment || null,
    message: data.message || '',
    read: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    async save() {
      db.notifications[_id] = { ...this };
      return this;
    },
    populate(field) {
      if (field === 'sender') {
        const s = db.users[(this.sender?._id || this.sender).toString()];
        this.sender = s ? { _id: s._id, name: s.name, username: s.username, profilePicture: s.profilePicture } : this.sender;
      }
      if (field === 'post' && this.post) {
        const p = db.posts[(this.post?._id || this.post).toString()];
        this.post = p ? { _id: p._id, content: p.content, image: p.image } : this.post;
      }
      return Promise.resolve(this);
    },
  };
  db.notifications[_id] = doc;
  return doc;
};

Notification.find = function (query) {
  const rid = (query?.recipient?._id || query?.recipient)?.toString();
  let list = Object.values(db.notifications).filter((n) => (n.recipient?._id || n.recipient).toString() === rid);
  const q = {
    sort: () => q,
    limit: (num) => {
      list = list.slice(0, num);
      return q;
    },
    populate: (field) => {
      list.forEach((n) => {
        if (field === 'sender') {
          const s = db.users[(n.sender?._id || n.sender).toString()];
          n.sender = s ? { _id: s._id, name: s.name, username: s.username, profilePicture: s.profilePicture } : n.sender;
        }
        if (field === 'post' && n.post) {
          const p = db.posts[(n.post?._id || n.post).toString()];
          n.post = p ? { _id: p._id, content: p.content, image: p.image } : n.post;
        }
      });
      return q;
    },
    then: (r, e) => Promise.resolve(list).then(r, e),
  };
  return q;
};

Notification.findById = function (id) {
  const nid = (id?._id || id)?.toString();
  const n = db.notifications[nid];
  if (!n) return Promise.resolve(null);
  const copy = { ...n };
  copy.save = async function () {
    db.notifications[nid] = { ...this };
    return this;
  };
  return Promise.resolve(copy);
};

Notification.countDocuments = function (query) {
  const rid = (query?.recipient?._id || query?.recipient)?.toString();
  let list = Object.values(db.notifications).filter((n) => (n.recipient?._id || n.recipient).toString() === rid);
  if (typeof query?.read === 'boolean') {
    list = list.filter((n) => n.read === query.read);
  }
  return Promise.resolve(list.length);
};

Notification.updateMany = async function (query, update) {
  const rid = (query?.recipient?._id || query?.recipient)?.toString();
  let count = 0;
  for (const n of Object.values(db.notifications)) {
    if ((n.recipient?._id || n.recipient).toString() === rid && (query?.read === undefined || n.read === query.read)) {
      if (update?.$set?.read !== undefined) n.read = update.$set.read;
      count++;
    }
  }
  return { acknowledged: true, modifiedCount: count };
};

Notification.deleteMany = async function (query) {
  let count = 0;
  for (const [id, n] of Object.entries(db.notifications)) {
    let match = true;
    if (query?.$or) {
      match = query.$or.some((cond) => {
        if (cond.recipient && (n.recipient?._id || n.recipient).toString() === cond.recipient.toString()) return true;
        if (cond.sender && (n.sender?._id || n.sender).toString() === cond.sender.toString()) return true;
        return false;
      });
    } else {
      if (query?.recipient && (n.recipient?._id || n.recipient).toString() !== query.recipient.toString()) match = false;
      if (query?.sender && (n.sender?._id || n.sender).toString() !== query.sender.toString()) match = false;
      if (query?.type && n.type !== query.type) match = false;
      if (query?.post && (n.post?._id || n.post)?.toString() !== query.post.toString()) match = false;
      if (query?.read !== undefined && n.read !== query.read) match = false;
    }
    if (match) {
      delete db.notifications[id];
      count++;
    }
  }
  return { acknowledged: true, deletedCount: count };
};

// Conversation & Message Model Mocks
Conversation.create = async function (data) {
  const _id = nextId();
  const conv = {
    _id,
    participants: data.participants,
    lastMessage: data.lastMessage || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    async save() {
      db.conversations[_id] = { ...this };
      return this;
    },
    populate: async function () {
      return this;
    },
    toObject() {
      return {
        _id: this._id,
        participants: this.participants,
        lastMessage: this.lastMessage,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    },
  };
  db.conversations[_id] = conv;
  return conv;
};

Conversation.findOne = function (query) {
  let found = null;
  if (query?.participants?.$all) {
    const p1 = query.participants.$all[0].toString();
    const p2 = query.participants.$all[1].toString();
    found = Object.values(db.conversations).find((c) => {
      const parts = c.participants.map((p) => (p?._id || p).toString());
      return parts.includes(p1) && parts.includes(p2);
    });
  }
  const nullQuery = {
    populate: () => nullQuery,
    sort: () => nullQuery,
    select: () => nullQuery,
    then: (r, e) => Promise.resolve(null).then(r, e),
  };
  if (!found) {
    return nullQuery;
  }
  const copy = { ...found };
  copy.save = async function () {
    db.conversations[copy._id] = { ...this };
    return this;
  };
  copy.populate = async function () {
    return copy;
  };
  copy.toObject = function () {
    return {
      _id: copy._id,
      participants: copy.participants,
      lastMessage: copy.lastMessage,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
  };
  const q = {
    populate: () => q,
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
  return q;
};

Conversation.findById = function (id) {
  const cid = (id?._id || id)?.toString();
  const c = db.conversations[cid];
  const nullQuery = {
    populate: () => nullQuery,
    sort: () => nullQuery,
    select: () => nullQuery,
    then: (r, e) => Promise.resolve(null).then(r, e),
  };
  if (!c) {
    return nullQuery;
  }
  const copy = { ...c };
  copy.save = async function () {
    db.conversations[cid] = { ...this };
    return this;
  };
  copy.populate = async function () {
    return copy;
  };
  copy.toObject = function () {
    return {
      _id: copy._id,
      participants: copy.participants,
      lastMessage: copy.lastMessage,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
  };
  const q = {
    populate: () => q,
    then: (r, e) => Promise.resolve(copy).then(r, e),
  };
  return q;
};

Conversation.find = function (query) {
  let list = Object.values(db.conversations);
  if (query?.participants) {
    const pid = (query.participants?._id || query.participants).toString();
    list = list.filter((c) => c.participants.some((p) => (p?._id || p).toString() === pid));
  }
  const q = {
    sort: () => q,
    populate: () => q,
    then: (r, e) => Promise.resolve(list).then(r, e),
  };
  return q;
};

Conversation.deleteMany = async function (query) {
  let count = 0;
  for (const [id, c] of Object.entries(db.conversations)) {
    if (query?.participants && c.participants.some((p) => (p?._id || p).toString() === query.participants.toString())) {
      delete db.conversations[id];
      count++;
    }
  }
  return { acknowledged: true, deletedCount: count };
};

Message.create = async function (data) {
  const _id = nextId();
  const doc = {
    _id,
    conversation: data.conversation,
    sender: data.sender,
    recipient: data.recipient,
    content: data.content,
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    async save() {
      db.messages[_id] = { ...this };
      return this;
    },
    populate(field) {
      if (field === 'sender') {
        const s = db.users[(this.sender?._id || this.sender).toString()];
        this.sender = s ? { _id: s._id, name: s.name, username: s.username, profilePicture: s.profilePicture } : this.sender;
      }
      return Promise.resolve(this);
    },
  };
  db.messages[_id] = doc;
  return doc;
};

Message.find = function (query) {
  let list = Object.values(db.messages);
  if (query?.conversation) {
    const cid = (query.conversation?._id || query.conversation).toString();
    list = list.filter((m) => (m.conversation?._id || m.conversation).toString() === cid);
  }
  const q = {
    sort: () => q,
    populate: (field) => {
      list.forEach((m) => {
        if (field === 'sender') {
          const s = db.users[(m.sender?._id || m.sender).toString()];
          m.sender = s ? { _id: s._id, name: s.name, username: s.username, profilePicture: s.profilePicture } : m.sender;
        }
      });
      return q;
    },
    then: (r, e) => Promise.resolve(list).then(r, e),
  };
  return q;
};

Message.countDocuments = function (query) {
  let list = Object.values(db.messages);
  if (query?.conversation) {
    const cid = (query.conversation?._id || query.conversation).toString();
    list = list.filter((m) => (m.conversation?._id || m.conversation).toString() === cid);
  }
  if (query?.recipient) {
    const rid = (query.recipient?._id || query.recipient).toString();
    list = list.filter((m) => (m.recipient?._id || m.recipient).toString() === rid);
  }
  if (typeof query?.read === 'boolean') {
    list = list.filter((m) => m.read === query.read);
  }
  return Promise.resolve(list.length);
};

Message.updateMany = async function (query, update) {
  let count = 0;
  for (const m of Object.values(db.messages)) {
    let match = true;
    if (query?.conversation && (m.conversation?._id || m.conversation).toString() !== query.conversation.toString()) match = false;
    if (query?.recipient && (m.recipient?._id || m.recipient).toString() !== query.recipient.toString()) match = false;
    if (query?.read !== undefined && m.read !== query.read) match = false;
    if (match) {
      if (update?.$set?.read !== undefined) m.read = update.$set.read;
      if (update?.$set?.readAt !== undefined) m.readAt = update.$set.readAt;
      count++;
    }
  }
  return { acknowledged: true, modifiedCount: count };
};

Message.deleteMany = async function (query) {
  let count = 0;
  for (const [id, m] of Object.entries(db.messages)) {
    let match = false;
    if (query?.$or) {
      for (const cond of query.$or) {
        if (cond.sender && (m.sender?._id || m.sender).toString() === cond.sender.toString()) match = true;
        if (cond.recipient && (m.recipient?._id || m.recipient).toString() === cond.recipient.toString()) match = true;
      }
    }
    if (match) {
      delete db.messages[id];
      count++;
    }
  }
  return { acknowledged: true, deletedCount: count };
};

// ----------------------------------------------------
// Express App & Socket.io Setup
// ----------------------------------------------------
const app = express();
app.use(securityHeaders);
app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
app.use(generalLimiter);
app.use(express.json());
app.use(sanitizeNoSql);

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', chatRoutes);

app.use(errorHandler);

const server = http.createServer(app);
const io = initSocketServer(server, { corsOrigin: '*' });

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}/api`;
const socketUrl = `http://127.0.0.1:${port}`;

// Helper: connect authenticated socket
function connectSocket(token) {
  return ioClient(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });
}

// Track results
const results = {
  auth: false,
  profile: false,
  posts: false,
  likes: false,
  comments: false,
  followers: false,
  search: false,
  chat: false,
  notifications: false,
  settingsSecurity: false,
  frontend: false,
};

let user1Token = '';
let user2Token = '';
let user3Token = '';
let user1Id = '';
let user2Id = '';
let user3Id = '';

try {
  // ====================================================
  // 1. AUTHENTICATION TESTS
  // ====================================================
  console.log('[1/10] Testing Authentication...');

  // 1a. Register user 1
  const resReg1 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Wonder',
      username: 'alice',
      email: 'alice@example.com',
      password: 'Password123!',
    }),
  });
  assert.equal(resReg1.status, 201, 'Register must return 201');
  const dataReg1 = await resReg1.json();
  assert.ok(dataReg1.token, 'Register must return token');
  assert.equal(dataReg1.user.username, 'alice');
  assert.equal(dataReg1.user.password, undefined, 'Password must not be returned');
  user1Token = dataReg1.token;
  user1Id = dataReg1.user._id;

  // Verify password was hashed with bcryptjs in DB
  const rawAliceInDb = db.users[user1Id];
  assert.ok(rawAliceInDb.password !== 'Password123!', 'Password must be hashed');
  assert.ok(await comparePassword('Password123!', rawAliceInDb.password), 'Hashed password must verify with comparePassword');

  // 1b. Duplicate email registration
  const resDupEmail = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Alice',
      username: 'alice2',
      email: 'alice@example.com',
      password: 'Password123!',
    }),
  });
  assert.ok(resDupEmail.status === 400 || resDupEmail.status === 409, 'Duplicate email must return 400 or 409');

  // 1c. Duplicate username registration
  const resDupUser = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Alice',
      username: 'alice',
      email: 'different@example.com',
      password: 'Password123!',
    }),
  });
  assert.ok(resDupUser.status === 400 || resDupUser.status === 409, 'Duplicate username must return 400 or 409');

  // 1d. Login valid credentials
  const resLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'Password123!',
    }),
  });
  assert.equal(resLogin.status, 200);
  const dataLogin = await resLogin.json();
  assert.ok(dataLogin.token);
  assert.equal(dataLogin.user.name, 'Alice Wonder');

  // 1e. Login invalid password
  const resBadPass = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'WrongPassword!',
    }),
  });
  assert.equal(resBadPass.status, 401, 'Invalid password must return 401');

  // 1f. Register User 2 and User 3 for multi-user tests
  const resReg2 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Builder',
      username: 'bob',
      email: 'bob@example.com',
      password: 'Password123!',
    }),
  });
  const dataReg2 = await resReg2.json();
  user2Token = dataReg2.token;
  user2Id = dataReg2.user._id;

  const resReg3 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Charlie Chaplin',
      username: 'charlie',
      email: 'charlie@example.com',
      password: 'Password123!',
    }),
  });
  const dataReg3 = await resReg3.json();
  user3Token = dataReg3.token;
  user3Id = dataReg3.user._id;

  // 1g. Missing / invalid / expired JWT on protected route
  const resNoToken = await fetch(`${baseUrl}/auth/me`);
  assert.equal(resNoToken.status, 401, 'Missing token must return 401');

  const resBadToken = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: 'Bearer thisisnotavalidjwt' },
  });
  assert.equal(resBadToken.status, 401, 'Malformed token must return 401');

  const expiredToken = jwt.sign({ id: user1Id }, process.env.JWT_SECRET, { expiresIn: '-1s' });
  const resExpired = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(resExpired.status, 401, 'Expired token must return 401');

  results.auth = true;
  console.log('  ✓ Authentication tests passed.');

  // ====================================================
  // 2. PROFILE TESTS
  // ====================================================
  console.log('[2/10] Testing Profile...');

  // 2a. View own profile
  const resMyProf = await fetch(`${baseUrl}/profile/me`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resMyProf.status, 200);
  const dataMyProf = await resMyProf.json();
  assert.equal(dataMyProf.user.username, 'alice');

  // 2b. Edit own profile
  const resEditProf = await fetch(`${baseUrl}/profile/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      name: 'Alice In Wonderland',
      bio: 'Adventurer and explorer',
    }),
  });
  assert.equal(resEditProf.status, 200);
  const dataEditProf = await resEditProf.json();
  assert.equal(dataEditProf.user.name, 'Alice In Wonderland');
  assert.equal(dataEditProf.user.bio, 'Adventurer and explorer');

  // 2c. Immutable email check
  const resChangeEmail = await fetch(`${baseUrl}/profile/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      email: 'hacker@example.com',
    }),
  });
  assert.equal(resChangeEmail.status, 400, 'Changing email must return 400');

  // 2d. Avatar upload validation
  const resBadAvatar = await fetch(`${baseUrl}/profile/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resBadAvatar.status, 400, 'Missing avatar file must return 400');

  results.profile = true;
  console.log('  ✓ Profile tests passed.');

  // ====================================================
  // 3. POSTS CRUD & AUTHORIZATION
  // ====================================================
  console.log('[3/10] Testing Posts CRUD & Permissions...');

  // 3a. Reject empty post
  const resEmptyPost = await fetch(`${baseUrl}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({ content: '' }),
  });
  assert.equal(resEmptyPost.status, 400, 'Empty post must return 400');

  // 3b. Create post
  const resCreatePost = await fetch(`${baseUrl}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({ content: 'Hello world from Alice!' }),
  });
  assert.equal(resCreatePost.status, 201);
  const dataCreatePost = await resCreatePost.json();
  const postId = dataCreatePost.post._id;
  assert.ok(postId);

  // 3c. Read all posts
  const resGetPosts = await fetch(`${baseUrl}/posts`);
  assert.equal(resGetPosts.status, 200);
  const dataGetPosts = await resGetPosts.json();
  assert.ok(Array.isArray(dataGetPosts.posts));
  assert.ok(dataGetPosts.posts.some((p) => p._id.toString() === postId.toString()));

  // 3d. Read single post
  const resGetSingle = await fetch(`${baseUrl}/posts/${postId}`);
  assert.equal(resGetSingle.status, 200);
  const dataGetSingle = await resGetSingle.json();
  assert.equal(dataGetSingle.post.content, 'Hello world from Alice!');

  // 3e. Non-owner cannot update post (403)
  const resBadUpdate = await fetch(`${baseUrl}/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2Token}`,
    },
    body: JSON.stringify({ content: 'Hacked by Bob' }),
  });
  assert.equal(resBadUpdate.status, 403, 'Non-owner update must return 403');

  // 3f. Owner updates post
  const resGoodUpdate = await fetch(`${baseUrl}/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({ content: 'Updated content by Alice!' }),
  });
  assert.equal(resGoodUpdate.status, 200);
  const dataGoodUpdate = await resGoodUpdate.json();
  assert.equal(dataGoodUpdate.post.content, 'Updated content by Alice!');

  // 3g. Non-owner cannot delete post (403)
  const resBadDelete = await fetch(`${baseUrl}/posts/${postId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resBadDelete.status, 403, 'Non-owner delete must return 403');

  results.posts = true;
  console.log('  ✓ Posts tests passed.');

  // ====================================================
  // 4. LIKES SYSTEM
  // ====================================================
  console.log('[4/10] Testing Likes & Toggles...');

  // 4a. Bob likes Alice's post
  const resLike1 = await fetch(`${baseUrl}/posts/${postId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resLike1.status, 200);
  const dataLike1 = await resLike1.json();
  assert.equal(dataLike1.liked, true);
  assert.equal(dataLike1.likesCount, 1);

  // Verify like recorded in post
  const postInDb = db.posts[postId];
  assert.ok(postInDb.likes.some((id) => (id?._id || id).toString() === user2Id.toString()));

  // 4b. Bob unlikes Alice's post (toggle back)
  const resUnlike = await fetch(`${baseUrl}/posts/${postId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resUnlike.status, 200);
  const dataUnlike = await resUnlike.json();
  assert.equal(dataUnlike.liked, false);
  assert.equal(dataUnlike.likesCount, 0);

  // 4c. Re-like post and verify no duplicate user IDs
  await fetch(`${baseUrl}/posts/${postId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  const postAfterRelike = db.posts[postId];
  const bobLikesCount = postAfterRelike.likes.filter((id) => (id?._id || id).toString() === user2Id.toString()).length;
  assert.equal(bobLikesCount, 1, 'Likes array must never contain duplicate user IDs');

  results.likes = true;
  console.log('  ✓ Likes tests passed.');

  // ====================================================
  // 5. COMMENTS SYSTEM
  // ====================================================
  console.log('[5/10] Testing Comments & Permissions...');

  // 5a. Bob comments on Alice's post
  const resComment = await fetch(`${baseUrl}/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2Token}`,
    },
    body: JSON.stringify({ content: 'Great post Alice!' }),
  });
  assert.equal(resComment.status, 201);
  const dataComment = await resComment.json();
  const commentId = dataComment.comment._id;
  assert.ok(commentId);
  assert.equal(db.posts[postId].comments.length, 1, 'Post comments count must increment');

  // 5b. Bob edits his comment
  const resEditComment = await fetch(`${baseUrl}/comments/${commentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2Token}`,
    },
    body: JSON.stringify({ content: 'Super great post Alice!' }),
  });
  assert.equal(resEditComment.status, 200);
  const dataEditComment = await resEditComment.json();
  assert.equal(dataEditComment.comment.content, 'Super great post Alice!');

  // 5c. Charlie cannot edit Bob's comment (403)
  const resBadEditComment = await fetch(`${baseUrl}/comments/${commentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3Token}`,
    },
    body: JSON.stringify({ content: 'Hacked comment' }),
  });
  assert.equal(resBadEditComment.status, 403, 'Non-owner comment edit must return 403');

  // 5d. Charlie cannot delete Bob's comment on Alice's post (403)
  const resBadDeleteComment = await fetch(`${baseUrl}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user3Token}` },
  });
  assert.equal(resBadDeleteComment.status, 403, 'Non-owner / non-post-author comment delete must return 403');

  // 5e. Bob deletes his own comment
  const resDeleteComment = await fetch(`${baseUrl}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resDeleteComment.status, 200);
  assert.equal(db.comments[commentId], undefined, 'Comment must be deleted');
  assert.equal(db.posts[postId].comments.length, 0, 'Post comments count must decrement');

  results.comments = true;
  console.log('  ✓ Comments tests passed.');

  // ====================================================
  // 6. FOLLOWERS, SEARCH & PUBLIC PROFILES
  // ====================================================
  console.log('[6/10] Testing Followers, Search & Public Profiles...');

  // 6a. Bob follows Alice
  const resFollow = await fetch(`${baseUrl}/users/${user1Id}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resFollow.status, 200);
  const dataFollow = await resFollow.json();
  assert.equal(dataFollow.isFollowing, true);

  // Verify Alice has Bob in followers, Bob has Alice in following
  assert.ok(db.users[user1Id].followers.some((id) => (id?._id || id).toString() === user2Id.toString()));
  assert.ok(db.users[user2Id].following.some((id) => (id?._id || id).toString() === user1Id.toString()));

  // 6b. Prevent self-follow
  const resSelfFollow = await fetch(`${baseUrl}/users/${user1Id}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resSelfFollow.status, 400, 'Self-follow must return 400');

  // 6c. Prevent duplicate follow
  const resDupFollow = await fetch(`${baseUrl}/users/${user1Id}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resDupFollow.status, 200);
  const bobFollowersCount = db.users[user1Id].followers.filter((id) => (id?._id || id).toString() === user2Id.toString()).length;
  assert.equal(bobFollowersCount, 1, 'Followers array must never contain duplicates');

  // 6d. Search users
  const resSearch = await fetch(`${baseUrl}/users/search?q=alice`);
  assert.equal(resSearch.status, 200);
  const dataSearch = await resSearch.json();
  assert.ok(dataSearch.users.some((u) => u.username === 'alice'));

  // 6e. View public profile by username
  const resPubProfile = await fetch(`${baseUrl}/users/profile/alice`);
  assert.equal(resPubProfile.status, 200);
  const dataPub = await resPubProfile.json();
  assert.equal(dataPub.user.username, 'alice');
  assert.equal(dataPub.user.followersCount, 1);

  // 6f. Unknown public profile returns 404
  const resPub404 = await fetch(`${baseUrl}/users/profile/nonexistent_user_999`);
  assert.equal(resPub404.status, 404, 'Unknown profile must return 404');

  results.followers = true;
  results.search = true;
  console.log('  ✓ Followers, Search & Public Profile tests passed.');

  // ====================================================
  // 7. REAL-TIME CHAT (REST + SOCKET.IO)
  // ====================================================
  console.log('[7/10] Testing Real-Time Chat (REST + Socket.io)...');

  // Connect sockets for Alice and Bob
  const socketAlice = connectSocket(user1Token);
  const socketBob = connectSocket(user2Token);

  await Promise.all([
    new Promise((resolve) => socketAlice.on('connect', resolve)),
    new Promise((resolve) => socketBob.on('connect', resolve)),
  ]);

  assert.ok(isUserOnline(user1Id), 'Alice must be online');
  assert.ok(isUserOnline(user2Id), 'Bob must be online');

  // 7a. Create conversation
  const resConv = await fetch(`${baseUrl}/messages/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({ recipientId: user2Id }),
  });
  assert.ok(resConv.status === 200 || resConv.status === 201, 'Create conversation must return 200 or 201');
  const dataConv = await resConv.json();
  const convId = dataConv.conversation._id;
  assert.ok(convId);

  // 7b. Send message Alice -> Bob & verify Socket.io delivery
  const bobMessagePromise = new Promise((resolve) => {
    socketBob.once('newMessage', resolve);
  });

  const resSendMsg = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      conversationId: convId,
      recipientId: user2Id,
      content: 'Hello Bob!',
    }),
  });
  assert.equal(resSendMsg.status, 201);

  const receivedSocketMsg = await Promise.race([
    bobMessagePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Socket.io newMessage timeout')), 3000)),
  ]);
  assert.equal(receivedSocketMsg.message?.content || receivedSocketMsg.content, 'Hello Bob!');

  // 7c. Typing indicators
  const bobTypingPromise = new Promise((resolve) => {
    socketBob.once('userTyping', resolve);
  });
  socketAlice.emit('typing', { conversationId: convId, recipientId: user2Id });
  const typingEvent = await Promise.race([
    bobTypingPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Typing timeout')), 3000)),
  ]);
  assert.equal(typingEvent.userId, user1Id);

  // 7d. Chat history & 403 non-participant check
  const resHist = await fetch(`${baseUrl}/messages/conversations/${convId}/messages`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resHist.status, 200);
  const dataHist = await resHist.json();
  assert.equal(dataHist.messages.length, 1);

  const resBadHist = await fetch(`${baseUrl}/messages/conversations/${convId}/messages`, {
    headers: { Authorization: `Bearer ${user3Token}` },
  });
  assert.equal(resBadHist.status, 403, 'Non-participant chat history must return 403');

  // 7e. Mark conversation read
  const resMarkRead = await fetch(`${baseUrl}/messages/conversations/${convId}/read`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(resMarkRead.status, 200);

  socketAlice.disconnect();
  socketBob.disconnect();

  results.chat = true;
  console.log('  ✓ Real-Time Chat tests passed.');

  // ====================================================
  // 8. NOTIFICATIONS (REST + SOCKET.IO)
  // ====================================================
  console.log('[8/10] Testing Notifications & Real-Time Push...');

  // Reset notifications for clean test
  for (const k of Object.keys(db.notifications)) delete db.notifications[k];

  // Fresh post for notification tests
  const notifPost = await Post.create({ author: user1Id, content: 'Notif test post' });
  const notifPostId = notifPost._id;

  // Self-action guard: Alice likes own post -> NO notification
  await fetch(`${baseUrl}/posts/${notifPostId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(Object.keys(db.notifications).length, 0, 'Self-like must NOT trigger notification');

  // Bob likes Alice's post -> Triggers LIKE notification
  await fetch(`${baseUrl}/posts/${notifPostId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  const notifsAfterLike = Object.values(db.notifications);
  assert.ok(notifsAfterLike.some((n) => n.type === 'LIKE' && (n.recipient?._id || n.recipient).toString() === user1Id));

  // Bob comments on Alice's post -> Triggers COMMENT notification
  await fetch(`${baseUrl}/posts/${notifPostId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2Token}`,
    },
    body: JSON.stringify({ content: 'Nice!' }),
  });
  const notifsAfterComment = Object.values(db.notifications);
  assert.ok(notifsAfterComment.some((n) => n.type === 'COMMENT'));

  // Get notifications & unread count
  const resGetNotifs = await fetch(`${baseUrl}/notifications`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resGetNotifs.status, 200);
  const dataGetNotifs = await resGetNotifs.json();
  assert.ok(dataGetNotifs.unreadCount >= 2);

  // Mark single notification read
  const notifId = dataGetNotifs.notifications[0]._id;
  const resMarkNotif = await fetch(`${baseUrl}/notifications/${notifId}/read`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resMarkNotif.status, 200);

  // Mark all notifications read
  const resMarkAll = await fetch(`${baseUrl}/notifications/read-all`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(resMarkAll.status, 200);
  const dataMarkAll = await resMarkAll.json();
  assert.equal(dataMarkAll.unreadCount, 0);

  results.notifications = true;
  console.log('  ✓ Notifications tests passed.');

  // ====================================================
  // 9. SETTINGS & SECURITY HARDENING
  // ====================================================
  console.log('[9/10] Testing Settings & Security Hardening...');

  // 9a. Change password
  const resChangePass = await fetch(`${baseUrl}/profile/me/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3Token}`,
    },
    body: JSON.stringify({
      currentPassword: 'Password123!',
      newPassword: 'BrandNewPassword123!',
      confirmPassword: 'BrandNewPassword123!',
    }),
  });
  assert.equal(resChangePass.status, 200);

  // Verify old password fails, new password succeeds
  const resOldLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'charlie@example.com', password: 'Password123!' }),
  });
  assert.equal(resOldLogin.status, 401);

  const resNewLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'charlie@example.com', password: 'BrandNewPassword123!' }),
  });
  assert.equal(resNewLogin.status, 200);

  // 9b. NoSQL injection sanitization test
  const resNoSql = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Injection Test',
      username: 'inject_test',
      email: 'inject@example.com',
      password: 'Password123!',
      $where: 'evil()',
      operator: { $gt: '' },
    }),
  });
  assert.equal(resNoSql.status, 201);
  const createdUser = Object.values(db.users).find((u) => u.username === 'inject_test');
  assert.equal(createdUser.$where, undefined, '$where must be stripped');
  assert.equal(createdUser.operator, undefined);

  // 9c. Delete account
  const resDeleteAccount = await fetch(`${baseUrl}/profile/me`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3Token}`,
    },
    body: JSON.stringify({ password: 'BrandNewPassword123!' }),
  });
  assert.equal(resDeleteAccount.status, 200);
  assert.equal(db.users[user3Id], undefined, 'Deleted user must be removed from DB');

  results.settingsSecurity = true;
  console.log('  ✓ Settings & Security tests passed.');

  // ====================================================
  // 10. FRONTEND CONTRACT & ROUTE VERIFICATION
  // ====================================================
  console.log('[10/10] Verifying Frontend Contracts & App.jsx Routes...');

  const appJsx = fs.readFileSync(path.join('..', 'frontend', 'src', 'App.jsx'), 'utf8');
  const requiredRoutes = [
    '/login',
    '/register',
    '/',
    '/profile',
    '/profile/:username',
    '/search',
    '/notifications',
    '/messages',
    '/settings',
  ];

  for (const route of requiredRoutes) {
    assert.ok(
      appJsx.includes(`path="${route}"`),
      `App.jsx must declare route for ${route}`
    );
  }

  // Verify all page imports in App.jsx exist on disk
  const importedPages = [
    'Home.jsx',
    'Login.jsx',
    'Messages.jsx',
    'Notifications.jsx',
    'Profile.jsx',
    'PublicProfile.jsx',
    'Register.jsx',
    'Search.jsx',
    'Settings.jsx',
  ];

  for (const page of importedPages) {
    const pagePath = path.join('..', 'frontend', 'src', 'pages', page);
    assert.ok(fs.existsSync(pagePath), `Page file ${page} must exist at ${pagePath}`);
  }

  results.frontend = true;
  console.log('  ✓ Frontend contracts & route checks passed.');

  console.log('\n====================================================');
  console.log('ALL STEP 19 COMPREHENSIVE TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
} finally {
  server.close();
}
