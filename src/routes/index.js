const express = require("express");
const router = express.Router();

const ebirr = require("../controllers/ebirr");

router.post("/create", ebirr.create);

router.post("/purchase", ebirr.hppPurchase);

router.post("/callback", ebirr.callback);

router.post("/apiPurchase", ebirr.apiPurchase);

router.get("/details/:referenceNumber", ebirr.getBillDetail);

module.exports = router;
