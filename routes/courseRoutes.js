const express = require(
  "express"
);

const {
  generateAiCourse,
  fetchGenerationStatus,
  resumeCourseGeneration,
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
  Start background AI generation

  POST /api/courses/generate
*/

router.post(
  "/generate",
  generateAiCourse
);

/*
  Get live generation status

  GET /api/courses/generation/:jobId?userId=1
*/

router.get(
  "/generation/:jobId",
  fetchGenerationStatus
);

/*
  Resume failed generation

  POST /api/courses/generation/:jobId/resume
*/

router.post(
  "/generation/:jobId/resume",
  resumeCourseGeneration
);

/*
  Temporary sample course
*/

router.post(
  "/sample",
  createSampleCourse
);

/*
  Logged-in user's courses
*/

router.get(
  "/my-courses",
  fetchMyCourses
);

/*
  All published courses
*/

router.get(
  "/",
  fetchAllCourses
);

/*
  Download course notes
*/

router.get(
  "/:courseId/download-notes",
  downloadCourseNotesPdf
);

/*
  Complete course
*/

router.get(
  "/:courseId",
  fetchCourseById
);

/*
  Delete own course
*/

router.delete(
  "/:courseId",
  deleteMyCourse
);

module.exports = router;