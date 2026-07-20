const {
  getCompleteCourseById,
} = require(
  "../models/courseModel"
);

const {
  findUserById,
} = require(
  "../models/userModel"
);

const {
  writeCourseNotesPdf,
} = require(
  "../services/coursePdfService"
);


/*
  Download course notes PDF

  GET /api/courses/:courseId/download-notes?userId=1
*/

const downloadCourseNotesPdf =
  async (
    req,
    res
  ) => {
    try {
      const courseId =
        Number(
          req.params.courseId
        );

      const userId =
        Number(
          req.user?.id ||
            req.query.userId
        );

      if (
        !Number.isInteger(
          courseId
        ) ||
        courseId <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "A valid course ID is required",
          });
      }

      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "A valid logged-in user ID is required",
          });
      }

      const [
        course,
        user,
      ] =
        await Promise.all([
          getCompleteCourseById(
            courseId
          ),

          findUserById(
            userId
          ),
        ]);

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Logged-in user was not found",
          });
      }

      if (!course) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Course not found",
          });
      }

      if (
        Number(
          course.user_id
        ) !== userId
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "You cannot download notes for this course",
          });
      }

      writeCourseNotesPdf({
        response: res,
        course,
        user,
      });
    } catch (error) {
      console.error(
        "Download Course PDF Error:",
        error
      );

      if (
        res.headersSent
      ) {
        res.end();

        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to generate course notes PDF",
        });
    }
  };


module.exports = {
  downloadCourseNotesPdf,
};