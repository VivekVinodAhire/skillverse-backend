const {
  updateLessonProgress,
  getSingleLessonProgress,
  getCourseProgress,
} = require("../models/progressModel");

/*
  Temporary user helper.

  Authentication पूर्ण connect झाल्यावर
  body मधील userId remove करून req.user.id वापरायचा.
*/

const resolveUserId = (req) => {
  const possibleUserId =
    req.user?.id ||
    req.body?.userId ||
    req.query?.userId;

  const userId = Number(possibleUserId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  return userId;
};

const markLessonProgress = async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);

    const {
      courseId,
      isCompleted = true,
    } = req.body;

    const parsedCourseId = Number(courseId);
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "A valid user ID is required",
      });
    }

    if (
      !Number.isInteger(lessonId) ||
      lessonId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid lesson ID is required",
      });
    }

    if (
      !Number.isInteger(parsedCourseId) ||
      parsedCourseId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid course ID is required",
      });
    }

    const progress = await updateLessonProgress({
      userId,
      courseId: parsedCourseId,
      lessonId,
      isCompleted: Boolean(isCompleted),
    });

    const courseProgress = await getCourseProgress({
      userId,
      courseId: parsedCourseId,
    });

    return res.status(200).json({
      success: true,

      message: isCompleted
        ? "Lesson marked as completed"
        : "Lesson marked as incomplete",

      progress,
      courseProgress,
    });
  } catch (error) {
    console.error(
      "Update Lesson Progress Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update lesson progress",
    });
  }
};

const fetchLessonProgress = async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "A valid user ID is required",
      });
    }

    if (
      !Number.isInteger(lessonId) ||
      lessonId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid lesson ID is required",
      });
    }

    const progress = await getSingleLessonProgress({
      userId,
      lessonId,
    });

    return res.status(200).json({
      success: true,
      isCompleted: Boolean(
        progress?.is_completed
      ),
      progress,
    });
  } catch (error) {
    console.error(
      "Fetch Lesson Progress Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch lesson progress",
    });
  }
};

const fetchCourseProgress = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "A valid user ID is required",
      });
    }

    if (
      !Number.isInteger(courseId) ||
      courseId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid course ID is required",
      });
    }

    const progress = await getCourseProgress({
      userId,
      courseId,
    });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    return res.status(200).json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error(
      "Fetch Course Progress Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch course progress",
    });
  }
};

module.exports = {
  markLessonProgress,
  fetchLessonProgress,
  fetchCourseProgress,
};