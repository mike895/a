const MedaBills = require("meda-bills");

const stringToBoolean = function (string) {
  switch (string.toLowerCase().trim()) {
    case "true":
    case "yes":
    case "1":
      return true;
    case "false":
    case "no":
    case "0":
    case null:
      return false;
    default:
      return Boolean(string);
  }
};

module.exports = MedaBills.init(
  {
    jwtSecret: "nMRdY6jNDnEtFaigJM2ZHEH266UmKWRT",
  },
  true
);
