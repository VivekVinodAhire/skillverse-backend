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
  Start background AI course generation

  POST /api/courses/generate
*/

router.post(
  "/generate",
  generateAiCourse
);

/*
  Get generation progress

  GET /api/courses/generation/:jobId?userId=1
*/

router.get(
  "/generation/:jobId",
  fetchGenerationStatus
);

/*
  Resume interrupted generation

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
  Get complete course
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