const {
  getQuizzesByUserId,
  getQuizById,
} = require(
  "../models/quizModel"
);


const fetchMyQuizzes = async (
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

    const quizzes =
      await getQuizzesByUserId(
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
          quizzes.length,

        quizzes,
      });
  } catch (error) {
    console.error(
      "Fetch My Quizzes Error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message ||
          "Failed to fetch your quizzes",
      });
  }
};


const fetchQuizById = async (
  req,
  res
) => {
  try {
    const quizId =
      Number(
        req.params.quizId
      );

    const userId =
      Number(
        req.user?.id ||
          req.query.userId
      );

    if (
      !Number.isInteger(quizId) ||
      quizId <= 0
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "A valid quiz ID is required",
        });
    }

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

    const quiz =
      await getQuizById({
        quizId,
        userId,
      });

    if (!quiz) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "Quiz not found or you cannot access this quiz",
        });
    }

    return res
      .status(200)
      .json({
        success: true,

        quiz,
      });
  } catch (error) {
    console.error(
      "Fetch Quiz Error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message ||
          "Failed to fetch quiz",
      });
  }
};


module.exports = {
  fetchMyQuizzes,
  fetchQuizById,
};