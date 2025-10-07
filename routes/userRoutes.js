const express = require("express");

const router = express.Router();

// Validators
const {
  getUserValidator,
  createUserValidator,
  updateUserValidator,
  deleteUserValidator,
  changeUserPasswordValidator,
  approveOwnerValidator,
  updateLoggedUserValidator,
  changeLoggedUserPasswordValidator,
} = require("../utils/validators/userValidator");

// Services (Controllers)
const {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  uploadUserImage,
  resizeImage,
  deactivateUser,
  changeUserPaswword,
  approveOwnerAccount,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deactivateLoggedUser,
  saveFcmToken,
  getUnapprovedCompanies,
  getUsersWithLands,
} = require("../services/userService");
const auth = require("../services/authService");

router.use(auth.protect);
router.post("/update-fcm-token", saveFcmToken);
router.get("/getMe", getLoggedUserData, getUser);
router.put(
  "/changeMyPassword",
  changeLoggedUserPasswordValidator,
  updateLoggedUserPassword
);
router.put(
  "/updateMyData",
  uploadUserImage,
  resizeImage,
  updateLoggedUserValidator,
  updateLoggedUserData
);
router.delete("/deleteMe", auth.protect, deactivateLoggedUser);

//Route to Change password user
router.put(
  "/changePassword/:id",
  changeUserPasswordValidator,
  changeUserPaswword
);
//Route to Deactivated user
router.put("/deactivate/:id", deactivateUser);

//router.patch("/update-player-id/:id", updatePlayerId);

// Route to handle all users
router
  .route("/")
  .get(auth.allowedTo("admin"), getUsers) // Fetch all users
  .post(
    uploadUserImage,
    resizeImage,
    auth.allowedTo("admin"),
    createUserValidator,
    createUser
  ); // Create a new user

router.get(
  "/with-lands",
  auth.protect,
  auth.allowedTo("admin"),
  getUsersWithLands
);

router.get(
  "/unapproved",
  auth.protect,
  auth.allowedTo("admin"),
  getUnapprovedCompanies
);
// Route to handle a single user by ID
router
  .route("/:id")
  .get(auth.allowedTo("admin"), getUserValidator, getUser) // Fetch a user by ID with validation
  .put(
    uploadUserImage,
    resizeImage,
    auth.allowedTo("admin"),
    updateUserValidator,
    updateUser
  ) // Update a user by ID with validation
  .delete(deleteUserValidator, auth.allowedTo("admin"), deleteUser); // Delete a user by ID with validation

//Route to approve owner
router.get(
  "/approveOwner/:id",
  auth.allowedTo("admin"),
  approveOwnerValidator,
  approveOwnerAccount
);

module.exports = router;
