const express = require(
  "express"
);

const {
  sendTutorMessage,
} = require(
  "../controllers/aiTutorController"
);

const router =
  express.Router();

router.post(
  "/chat",
  sendTutorMessage
);

module.exports = router;