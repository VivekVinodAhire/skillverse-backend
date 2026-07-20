const express = require(
  "express"
);

const {
  fetchMyLessons,
  fetchLessonById,
} = require(
  "../controllers/lessonController"
);

const router =
  express.Router();


/*
  GET /api/lessons/my-lessons?userId=1
*/

router.get(
  "/my-lessons",
  fetchMyLessons
);


/*
  GET /api/lessons/:lessonId
*/

router.get(
  "/:lessonId",
  fetchLessonById
);


module.exports = router;