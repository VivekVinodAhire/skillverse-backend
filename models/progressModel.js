const { pool } = require("../config/db");

/*
  Lesson complete किंवा incomplete करणे.
*/

const updateLessonProgress = async ({
  userId,
  courseId,
  lessonId,
  isCompleted,
}) => {
  await pool.execute(
    `
      INSERT INTO lesson_progress (
        user_id,
        course_id,
        lesson_id,
        is_completed,
        completed_at
      )
      VALUES (
        ?, ?, ?, ?, ?
      )

      ON DUPLICATE KEY UPDATE
        course_id = VALUES(course_id),
        is_completed = VALUES(is_completed),
        completed_at = VALUES(completed_at),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      courseId,
      lessonId,
      isCompleted,
      isCompleted ? new Date() : null,
    ]
  );

  return getSingleLessonProgress({
    userId,
    lessonId,
  });
};

/*
  एका lesson ची progress मिळवणे.
*/

const getSingleLessonProgress = async ({
  userId,
  lessonId,
}) => {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        user_id,
        course_id,
        lesson_id,
        is_completed,
        completed_at,
        updated_at

      FROM lesson_progress

      WHERE user_id = ?
      AND lesson_id = ?

      LIMIT 1
    `,
    [userId, lessonId]
  );

  return rows[0] || null;
};

/*
  Complete course progress calculate करणे.
*/

const getCourseProgress = async ({
  userId,
  courseId,
}) => {
  const [rows] = await pool.execute(
    `
      SELECT
        c.id AS course_id,
        c.total_lessons,

        COUNT(
          CASE
            WHEN lp.is_completed = TRUE
            THEN 1
          END
        ) AS completed_lessons

      FROM courses c

      LEFT JOIN lesson_progress lp
        ON c.id = lp.course_id
        AND lp.user_id = ?

      WHERE c.id = ?

      GROUP BY
        c.id,
        c.total_lessons
    `,
    [userId, courseId]
  );

  if (rows.length === 0) {
    return null;
  }

  const totalLessons =
    Number(rows[0].total_lessons) || 0;

  const completedLessons =
    Number(rows[0].completed_lessons) || 0;

  const percentage =
    totalLessons > 0
      ? Math.round(
          (completedLessons / totalLessons) * 100
        )
      : 0;

  return {
    courseId: Number(courseId),
    totalLessons,
    completedLessons,
    remainingLessons:
      totalLessons - completedLessons,
    percentage,
    isCourseCompleted:
      totalLessons > 0 &&
      completedLessons >= totalLessons,
  };
};

module.exports = {
  updateLessonProgress,
  getSingleLessonProgress,
  getCourseProgress,
};