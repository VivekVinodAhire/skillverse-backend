const express = require(
  "express"
);

const {
  generateAiCourse,
  createSampleCourse,
  fetchAllCourses,
  fetchMyCourses,
  fetchCourseById,
  deleteMyCourse,
} = require(
  "../controllers/courseController"
);

const {
  downloadCourseNotesPdf,
} = require(
  "../controllers/coursePdfController"
);

const router =
  express.Router();


/*
  Generate and save AI course

  POST /api/courses/generate
*/

router.post(
  "/generate",
  generateAiCourse
);


/*
  Temporary sample course

  POST /api/courses/sample
*/

router.post(
  "/sample",
  createSampleCourse
);


/*
  Logged-in user's courses

  GET /api/courses/my-courses?userId=1
*/

router.get(
  "/my-courses",
  fetchMyCourses
);


/*
  Get all courses

  GET /api/courses
*/

router.get(
  "/",
  fetchAllCourses
);


/*
  Download course notes PDF

  GET /api/courses/:courseId/download-notes?userId=1
*/

router.get(
  "/:courseId/download-notes",
  downloadCourseNotesPdf
);


/*
  Get complete course by ID

  GET /api/courses/:courseId
*/

router.get(
  "/:courseId",
  fetchCourseById
);


/*
  Delete logged-in user's course

  DELETE /api/courses/:courseId?userId=1
*/

router.delete(
  "/:courseId",
  deleteMyCourse
);


module.exports = router;