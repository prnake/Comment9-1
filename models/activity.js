const config = require("../config");
const mongodb = require("../utils/mongodb");
const logger = require("../utils/logger");
const crypto = require("crypto");

const isContain = function (arr1, arr2) {
  for (let i = arr2.length - 1; i >= 0; i--) {
    if (!arr1.includes(arr2[i])) {
      return false;
    }
  }
  return true;
};

const activitySchema = mongodb.Schema(
  {
    name: { type: String, unique: true },
    owner: { type: Number, index: true },
    audit: { type: Boolean, default: false },
    senders: { type: [String], default: ["danmaku"] },
    filters: { type: [String], default: ["default"] },
    tokens: { type: Map, of: { token: String, perms: [String] }, default: {} },
    addons: { type: mongodb.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

activitySchema.methods.updateInfo = function (data, callback) {
  if (data.audit !== undefined) this.audit = !!data.audit;
  if (data.senders && isContain(config.danmaku.senders, data.senders))
    this.senders = data.senders;
  if (data.filters && isContain(config.danmaku.filters, data.filters))
    this.filters = data.filters;
  this.save(callback);
};

activitySchema.methods.updateName = function (name, callback) {
  this.name = name;
  this.save(callback);
};

activitySchema.methods.setAudit = function (audit, callback) {
  this.audit = !!audit;
  this.save(callback);
};

activitySchema.methods.setSenders = function (senders, callback) {
  if (senders && isContain(config.danmaku.senders, senders))
    this.senders = senders;
  this.save(callback);
};

activitySchema.methods.setFilters = function (filters, callback) {
  if (filters && isContain(config.danmaku.filters, filters))
    this.filters = filters;
  this.save(callback);
};

activitySchema.methods.setToken = function (name, token, perms, callback) {
  this.tokens.set(name, { token: token, perms: perms });
  this.save(callback);
};

activitySchema.methods.delToken = function (name, callback) {
  this.tokens.delete(name);
  this.save(callback);
};

activitySchema.methods.setAddon = function (name, value, callback) {
  if (!this.addons) this.addons = {};
  this.addons[name] = value;
  this.markModified("addons");
  this.save(callback);
};

activitySchema.methods.delAddon = function (name, callback) {
  delete this.addons[name];
  this.markModified("addons");
  this.save(callback);
};

const genToken = function () {
  let hash = crypto.createHash("sha1");
  hash.update(crypto.randomBytes(32));
  hash.update("t" + new Date().getTime());
  return hash.digest("hex");
};

activitySchema.statics.genToken = genToken;

activitySchema.statics.createActivity = function (name, owner, callback) {
  if (!callback) {
    callback = function () {};
  }
  const item = new Activity({ name: name, owner: owner });
  item.tokens.set("screen", { token: genToken(), perms: ["pull"] });
  item.tokens.set("user", { token: genToken(), perms: ["pull", "push"] });
  item.tokens.set("audit", {
    token: genToken(),
    perms: ["pull", "push", "audit"],
  });
  item.save(function (err) {
    if (err) logger.error(err);
    callback(err, item._id);
  });
};

activitySchema.statics.findByOwner = function (owner, callback) {
  if (!callback) {
    return;
  }
  Activity.find({ owner: owner }, "_id name", callback);
};

activitySchema.statics.deleteById = function (id, callback) {
  if (!callback) {
    callback = function () {};
  }
  Activity.findOneAndRemove({ _id: id }, callback);
};

activitySchema.statics.getActivity = function (id, callback) {
  if (!callback) return;
  Activity.findOne({ _id: id }, callback);
};

const Activity = mongodb.model("Activity", activitySchema);

module.exports = Activity;
