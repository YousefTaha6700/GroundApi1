class ApiFeature {
  constructor(mongooseQuery, queryString) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString;
  }

  filtir() {
    const queryStringObject = { ...this.queryString }; // Corrected the typo here
    const excludeFields = ["page", "sort", "limit", "fields", "keyword"];
    excludeFields.forEach((field) => delete queryStringObject[field]);

    // Apply filters using [gte|gt|lt|lte]
    let queryStr = JSON.stringify(queryStringObject);
    queryStr = queryStr.replace(/\b(gte|gt|lt|lte)\b/g, (match) => `$${match}`);

    this.mongooseQuery = this.mongooseQuery.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort("-createdAt");
    }
    return this;
  }

  selection() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select("-__v");
    }
    return this;
  }

  search(modelName) {
    if (this.queryString.keyword) {
      const keyword = this.queryString.keyword.trim();
      let searchQuery = {};
      if (modelName === "Product") {
        searchQuery = {
          $or: [
            { title: { $regex: new RegExp(keyword, "i") } },
            { description: { $regex: new RegExp(keyword, "i") } },
          ],
        };
      } else {
        searchQuery = {
          $or: [
            { name: { $regex: new RegExp(keyword, "i") } },
            { description: { $regex: new RegExp(keyword, "i") } },
          ],
        };
      }

      this.mongooseQuery = this.mongooseQuery.find(searchQuery);
    }
    return this;
  }

  paginate(countDoucemnts) {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 5;
    const skip = (page - 1) * limit;
    const endIndex = page * limit;

    const pagination = {};
    pagination.currentPage = page;
    pagination.limit = limit;
    pagination.numberOfPage = Math.ceil(countDoucemnts / limit);

    // Next page
    if (endIndex < countDoucemnts) {
      pagination.nextPage = page + 1;
    }
    // Prev page
    if (skip > 0) {
      pagination.prevPage = page - 1;
    }
    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);
    this.paginationResult = pagination;

    return this;
  }
}

module.exports = ApiFeature;
