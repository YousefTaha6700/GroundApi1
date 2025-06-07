const express = require("express");
const router = express.Router();
const { landValidator } = require("../utils/validators/landValidator");
const {
  addLand,
  getAllLands,
  getMyLands,
  getLandById,
  deleteLand,
  filterLands,
  toggleFavorite,
  approveLand,
  updateLand,
  updateLandUser,
  getFavoriteLands,
  isLandFavorited,
  getResidentialLands,
  uploadLandImage,
  resizeImage,
} = require("../services/landService");
const auth = require("../services/authService");

router.get("/myFavorites", auth.protect, getFavoriteLands);
router.get("/:id/isFavorited", auth.protect, isLandFavorited);

router.post("/", auth.protect, addLand);
router.get("/", getAllLands);
router.get("/mine", auth.protect, getMyLands);
router.get("/isResidential", auth.protect, getResidentialLands);

router.get("/filter", auth.protect, filterLands);
router.get("/:id", landValidator, getLandById); // For getting land details
router.delete("/:id", auth.protect, landValidator, deleteLand);
router.put("/favorite/:id", auth.protect, landValidator, toggleFavorite); // Change to PUT for toggling favorites

router.put("/updateLandPrice/:id", auth.protect, landValidator, updateLand);

router.put(
  "/adminUpdateLand/:id",
  auth.protect,
  auth.allowedTo("admin"),
  uploadLandImage,
  resizeImage,
  landValidator,
  updateLandUser
);
router.put(
  "/approveLand/:id",
  auth.protect,
  auth.allowedTo("admin"),
  landValidator,
  approveLand
);

module.exports = router;
