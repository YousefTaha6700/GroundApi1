const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/api_error");
// eslint-disable-next-line no-unused-vars
const ApiFeature = require("../utils/apiFeature");

exports.deleteOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const id = Object.values(req.params)[0]; // Dynamically extract the ID

    // Find the document by ID
    const document = await Model.findById(id);
    if (!document) {
      return next(new ApiError(req.t("no_item_found", { id }), 404));
    }

    // Use deleteOne to remove the document
    await document.deleteOne();

    res.status(200).json({ msg: req.t("deleted") });
  });

exports.updateOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const id = Object.values(req.params)[0]; // Dynamically extract the ID
    console.log(id);
    console.log(req.params);

    const document = await Model.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!document) {
      return next(new ApiError(req.t("id_not_found", { id }), 404));
    }

    // Trigger the save event when updating the document
    await document.save();
    res.status(200).json({ data: document });
  });

exports.createOne = (Model) =>
  asyncHandler(async (req, res) => {
    const doucemnt = await Model.create(req.body);
    res.status(201).json({ data: doucemnt });
  });

exports.getOne = (Model, populationOptstion) =>
  asyncHandler(async (req, res, next) => {
    const id = req.params.id || req.params.reviewId; // Adjust for different parameter names

    if (!id) {
      return next(new ApiError(req.t("no_item_found", { id }), 400));
    }

    let query = Model.findById(id);
    if (populationOptstion) {
      query = query.populate(populationOptstion);
    }

    const doucemnt = await query;
    if (!doucemnt) {
      return next(new ApiError(req.t("document_not_found", { id }), 404));
    }

    res.status(200).json({ data: doucemnt });
  });

exports.getAll = (Model, modelName) =>
  asyncHandler(async (req, res) => {
    let filter = {};
    if (req.filterObject) {
      filter = req.filterObject;
    }
    const countDoucemnts = await Model.countDocuments();

    const apiFeatures = new ApiFeature(
      Model.find({ active: true }, filter),
      req.query
    )
      .paginate(countDoucemnts)
      .filtir()
      .sort()
      .search(modelName)
      .selection();
    const { mongooseQuery, paginationResult } = apiFeatures;

    // Execute query
    const doucemnts = await mongooseQuery;
    res
      .status(200)
      .json({ results: doucemnts.length, paginationResult, data: doucemnts });
  });
