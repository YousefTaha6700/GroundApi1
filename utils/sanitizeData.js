exports.sanitizeUser = function (user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    role: user.role,
    companyName: user.companyName,
    isApprovedByAdmin: user.isApprovedByAdmin,
  };
};
