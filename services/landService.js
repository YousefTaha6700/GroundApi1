const Land = require("../models/landModel");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/api_error");
const { uploadMixOfImages } = require("../middlewares/uploadImageMiddleware");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");

const admin = require("../config/firebase");

//Upload Mix of images
exports.uploadLandImage = uploadMixOfImages([{ name: "images", maxCount: 5 }]);
// Resize user image
exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.images) {
    return next();
  }

  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file) => {
      const filename = `land-${uuidv4()}-${Date.now()}.jpeg`;
      await sharp(file.buffer)
        .resize(700, 700)
        .toFormat("jpeg")
        .jpeg({ quality: 90 })
        .toFile(`uploads/lands/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

exports.addLand = asyncHandler(async (req, res) => {
  const land = await Land.create({
    owner: req.user._id,
    ...req.body,
    fullPrice: req.body.meterPrice * req.body.area,
  });
  await land.populate("owner", "name phone role");

  res.status(201).json(land);
});

exports.getAllLands = asyncHandler(async (req, res) => {
  const { sortBy, includeResidential } = req.query;
  let sortCriteria = {};

  if (sortBy === "latest") sortCriteria = { createdAt: -1 };
  else if (sortBy === "mostViewed") sortCriteria = { views: -1 };

  const query = {
    status: "approved",
    active: true,
  };

  if (includeResidential !== "true") {
    query.isResidential = { $ne: true };
  }

  const lands = await Land.find(query)
    .populate({
      path: "owner",
      select: "name phone role",
      match: { active: true },
    })
    .sort(sortCriteria);

  const activeLands = lands.filter((land) => land.owner);

  res.json({ result: activeLands.length, data: activeLands });
});

exports.getMyLands = asyncHandler(async (req, res) => {
  const lands = await Land.find({
    owner: req.user._id,
    active: true,
  }).populate("owner", "name phone role");

  res.json(lands);
});

exports.getPendingLands = asyncHandler(async (req, res) => {
  const lands = await Land.find({
    status: "pending",
  }).populate("owner", "name phone role");

  res.json(lands);
});

exports.getResidentialLands = asyncHandler(async (req, res) => {
  const lands = await Land.find({
    isResidential: true,
    active: true,
  }).populate({
    path: "owner",
    select: "name phone role",
    match: { active: true },
  });

  const activeLands = lands.filter((land) => land.owner);

  res.json(activeLands);
});

exports.getLandById = asyncHandler(async (req, res, next) => {
  const land = await Land.findById(req.params.id).populate(
    "owner",
    "name phone role"
  );
  if (!land) return next(new ApiError(req.t("land_not_found"), 404));

  const userId = req.user?.id;

  if (userId && !land.viewedBy.includes(userId)) {
    land.viewedBy.push(userId);
    land.views++;
    await land.save();
  }

  res.json(land);
});

exports.deleteLand = asyncHandler(async (req, res, next) => {
  const land = await Land.findById(req.params.id);
  if (!land) return next(new ApiError(req.t("land_not_found"), 404));

  const isOwner = land.owner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin)
    return next(new ApiError(req.t("not_authorized_delete"), 403));

  await land.deleteOne();
  res.json({ message: req.t("land_deleted") });
});

exports.filterLands = asyncHandler(async (req, res) => {
  const {
    governorate,
    directorate,
    village,
    basin,
    region,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    minStreets,
    wLand,
  } = req.query;

  let query = {
    status: "approved",
    active: true,
  };

  if (wLand === "myLand") {
    query.owner = req.user._id;
    delete query.active;
  } else if (wLand === "favLand") {
    const userId = req.user._id;
    const favoriteLands = await Land.find({
      favorites: userId,
      active: true,
    }).populate({
      path: "owner",
      select: "name phone role",
      match: { active: true },
    });

    const activeFavoriteLands = favoriteLands.filter((land) => land.owner);
    query._id = { $in: activeFavoriteLands.map((land) => land._id) };
  }

  if (governorate) query["location.governorate"] = governorate;
  if (directorate) query["location.directorate"] = directorate;
  if (village) query["location.village"] = village;
  if (basin) query["location.basin"] = basin;
  if (region) query["location.region"] = region;

  if (minPrice || maxPrice) {
    query.meterPrice = {};
    if (minPrice) query.meterPrice.$gte = Number(minPrice);
    if (maxPrice) query.meterPrice.$lte = Number(maxPrice);
  }

  if (minArea || maxArea) {
    query.area = {};
    if (minArea) query.area.$gte = Number(minArea);
    if (maxArea) query.area.$lte = Number(maxArea);
  }

  if (minStreets) {
    query.streetCount = { $gte: Number(minStreets) };
  }

  const lands = await Land.find(query).populate({
    path: "owner",
    select: "name phone role",
    match: { active: true },
  });

  const activeLands = lands.filter((land) => land.owner);

  res.json(activeLands);
});

exports.toggleFavorite = asyncHandler(async (req, res, next) => {
  const land = await Land.findById(req.params.id);
  if (!land) return next(new ApiError(req.t("land_not_found"), 404));

  const userId = req.user.id;
  let action;

  if (land.favorites.includes(userId)) {
    land.favorites.pull(userId);
    land.favoritesCount--;
    action = "removed";
  } else {
    land.favorites.push(userId);
    land.favoritesCount++;
    action = "added";
  }

  await land.save();

  res.status(200).json({
    message: req.t("favorites_updated"),
    action, // "added" or "removed"
    favoritesCount: land.favoritesCount,
  });
});

exports.getFavoriteLands = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const favoriteLands = await Land.find({
    favorites: userId,
    active: true,
  }).populate({
    path: "owner",
    select: "name phone role",
    match: { active: true },
  });

  const activeFavoriteLands = favoriteLands.filter((land) => land.owner);

  res.json({ result: activeFavoriteLands.length, data: activeFavoriteLands });
});

exports.isLandFavorited = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const landId = req.params.id;

  const land = await Land.findById(landId);

  if (!land) {
    return res.status(404).json({ message: req.t("Land not found") });
  }

  const isFavorited = land.favorites.includes(userId.toString());

  res.json({ isFavorited });
});

exports.approveLand = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user._id;

  const user = await User.findById(adminId);
  if (!user || user.role !== "admin") {
    return next(new ApiError(req.t("not_authorized_approve"), 403));
  }

  const land = await Land.findById(id).populate("owner");
  if (!land) return next(new ApiError(req.t("land_not_found"), 404));

  land.status = "approved";
  land.approvedBy = adminId;
  land.approvalDate = new Date();
  await land.save();

  if (land.owner && land.owner.fcmToken) {
    const message = {
      token: land.owner.fcmToken,
      notification: {
        title: req.t("land_approved_title") || "تمت الموافقة على أرضك ✅",
        body:
          req.t("land_approved_message") ||
          `الأرض "${land.title || ""}" تمت الموافقة عليها ويمكن عرضها الآن.`,
      },
      data: {
        type: "land_approved",
        landId: land._id.toString(),
      },
    };

    try {
      await admin.messaging().send(message);
      console.log("Land approval notification sent successfully");
    } catch (error) {
      console.error("Error sending land approval notification:", error);
    }
  }

  res.json({ message: req.t("land_approved"), land });
});

exports.updateLand = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const land = await Land.findById(id);
  if (!land) return next(new ApiError(req.t("land_not_found"), 404));

  if (land.owner.toString() !== req.user._id.toString()) {
    return next(new ApiError(eq.t("not_authorized_update"), 403));
  }

  if (!req.body.meterPrice) {
    return next(new ApiError(req.t("only_meter_price_updatable"), 400));
  }

  land.meterPrice = req.body.meterPrice;
  land.fullPrice = land.meterPrice * land.area;

  await land.save();

  res.json({ message: req.t("land_price_updated"), land });
});

exports.updateLandUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(req.user._id);
  if (!user || user.role !== "admin") {
    return next(new ApiError(req.t("not_authorized_update"), 403));
  }

  const land = await Land.findById(id);
  if (!land) return next(new ApiError(req.t("land_not_found"), 404));

  const updatedFields = { ...req.body };
  const area = req.body.area || land.area;
  const meterPrice = req.body.meterPrice || land.meterPrice;
  updatedFields.fullPrice = area * meterPrice;

  const updatedLand = await Land.findByIdAndUpdate(id, updatedFields, {
    new: true,
    runValidators: true,
  });

  res.json({ message: req.t("land_updated"), land: updatedLand });
});
