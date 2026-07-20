const express = require("express");

const {
  markLessonProgress,
  fetchLessonProgress,
  fetchCourseProgress,
} = require("../controllers/progressController");

const router = express.Router();

/*
  Lesson progress save

  POST /api/progress/lessons/:lessonId
*/

router.post(
  "/lessons/:lessonId",
  markLessonProgress
);

/*
  Selected lesson progress

  GET /api/progress/lessons/:lessonId?userId=1
*/

router.get(
  "/lessons/:lessonId",
  fetchLessonProgress
);

/*
  Full course progress

  GET /api/progress/courses/:courseId?userId=1
*/

router.get(
  "/courses/:courseId",
  fetchCourseProgress
);

module.exports = router;