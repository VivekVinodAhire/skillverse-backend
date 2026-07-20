const {
  getLessonsByUserId,
  getLessonById,
} = require(
  "../models/lessonModel"
);


/*
  Get all lessons belonging to logged-in user.

  GET /api/lessons/my-lessons?userId=1
  GET /api/lessons/my-lessons?userId=1&courseId=5
*/

const fetchMyLessons = async (
  req,
  res
) => {
  try {
    const userId =
      Number(
        req.user?.id ||
          req.query.userId
      );

    const courseIdValue =
      req.query.courseId;

    const courseId =
      courseIdValue
        ? Number(
            courseIdValue
          )
        : null;

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "A valid user ID is required",
        });
    }

    if (
      courseIdValue &&
      (!Number.isInteger(
        courseId
      ) ||
        courseId <= 0)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "A valid course ID is required",
        });
    }

    const lessons =
      await getLessonsByUserId(
        {
          userId,
          courseId,
        }
      );

    return res
      .status(200)
      .json({
        success: true,

        total:
          lessons.length,

        lessons,
      });
  } catch (error) {
    console.error(
      "Fetch My Lessons Error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message ||
          "Failed to fetch your lessons",
      });
  }
};


/*
  Get one lesson by ID.

  GET /api/lessons/:lessonId
*/

const fetchLessonById =
  async (
    req,
    res
  ) => {
    try {
      const lessonId =
        Number(
          req.params.lessonId
        );

      const requestUserId =
        Number(
          req.user?.id ||
            req.query.userId
        );

      const userId =
        Number.isInteger(
          requestUserId
        ) &&
        requestUserId > 0
          ? requestUserId
          : null;

      if (
        !Number.isInteger(
          lessonId
        ) ||
        lessonId <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "A valid lesson ID is required",
          });
      }

      const lesson =
        await getLessonById(
          lessonId,
          userId
        );

      if (!lesson) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Lesson not found or you cannot access this lesson",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          lesson,
        });
    } catch (error) {
      console.error(
        "Fetch Lesson Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to fetch lesson",
        });
    }
  };


module.exports = {
  fetchMyLessons,
  fetchLessonById,
};