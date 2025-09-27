const admin = require("firebase-admin");
const path = require("path");

//const serviceAccount = require("./push-notification-key.json");
const serviceAccount = require(path.join(
  __dirname,
  "push-notification-key.json"
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
