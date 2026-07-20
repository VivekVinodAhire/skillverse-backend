const express = require("express");

const {
  testGemini,
  listGeminiModels,
} = require("../controllers/aiController");

const router = express.Router();

router.get("/test", testGemini);

router.get(
  "/models",
  listGeminiModels
);

module.exports = router;