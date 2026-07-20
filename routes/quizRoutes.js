const express = require(
  "express"
);

const {
  fetchMyQuizzes,
  fetchQuizById,
} = require(
  "../controllers/quizController"
);

const router =
  express.Router();


router.get(
  "/my-quizzes",
  fetchMyQuizzes
);


router.get(
  "/:quizId",
  fetchQuizById
);


module.exports = router;