const {
  pool,
} = require("../config/db");


/*
  Get all lessons belonging to a user.

  User
  → Courses
  → Course Modules
  → Lessons
*/

const getLessonsByUserId =
  async ({
    userId,
    courseId = null,
  }) => {
    const queryParams = [
      userId,
    ];

    let courseCondition = "";

    if (
      Number.isInteger(
        courseId
      ) &&
      courseId > 0
    ) {
      courseCondition =
        "AND c.id = ?";

      queryParams.push(
        courseId
      );
    }

    const [lessons] =
      await pool.execute(
        `
          SELECT
            l.id,
            l.module_id,
            l.title,
            l.description,
            l.content,
            l.lesson_order,
            l.lesson_type,
            l.duration_minutes,
            l.youtube_video_id,
            l.youtube_video_url,
            l.youtube_search_query,
            l.code_language,
            l.code_example,
            l.practice_task,
            l.summary,
            l.created_at,
            l.updated_at,

            cm.course_id,
            cm.title AS module_title,
            cm.module_order,
            cm.estimated_duration
              AS module_estimated_duration,

            c.title AS course_title,
            c.description
              AS course_description,
            c.category
              AS course_category,
            c.level
              AS course_level,
            c.language
              AS course_language,
            c.thumbnail_url,
            c.total_modules,
            c.total_lessons,

            COALESCE(
              lp.is_completed,
              0
            ) AS is_completed,

            lp.completed_at

          FROM lessons l

          INNER JOIN course_modules cm
            ON cm.id = l.module_id

          INNER JOIN courses c
            ON c.id = cm.course_id

          LEFT JOIN lesson_progress lp
            ON lp.lesson_id = l.id
            AND lp.course_id = c.id
            AND lp.user_id = ?

          WHERE c.user_id = ?

          ${courseCondition}

          ORDER BY
            c.created_at DESC,
            cm.module_order ASC,
            l.lesson_order ASC
        `,
        [
          userId,
          ...queryParams,
        ]
      );

    return lessons;
  };


/*
  Get one lesson with course and module information.
*/

const getLessonById = async (
  lessonId,
  userId = null
) => {
  const queryValues = [
    userId,
    lessonId,
  ];

  let ownershipCondition =
    "";

  if (
    Number.isInteger(userId) &&
    userId > 0
  ) {
    ownershipCondition =
      "AND c.user_id = ?";

    queryValues.push(
      userId
    );
  }

  const [lessonRows] =
    await pool.execute(
      `
        SELECT
          l.id,
          l.module_id,
          l.title,
          l.description,
          l.content,
          l.lesson_order,
          l.lesson_type,
          l.duration_minutes,
          l.youtube_video_id,
          l.youtube_video_url,
          l.youtube_search_query,
          l.code_language,
          l.code_example,
          l.practice_task,
          l.summary,
          l.created_at,
          l.updated_at,

          cm.course_id,
          cm.title AS module_title,
          cm.description
            AS module_description,
          cm.module_order,
          cm.estimated_duration
            AS module_estimated_duration,

          c.user_id,
          c.title AS course_title,
          c.description
            AS course_description,
          c.category
            AS course_category,
          c.level
            AS course_level,
          c.language
            AS course_language,
          c.total_modules,
          c.total_lessons,

          COALESCE(
            lp.is_completed,
            0
          ) AS is_completed,

          lp.completed_at

        FROM lessons l

        INNER JOIN course_modules cm
          ON cm.id = l.module_id

        INNER JOIN courses c
          ON c.id = cm.course_id

        LEFT JOIN lesson_progress lp
          ON lp.lesson_id = l.id
          AND lp.course_id = c.id
          AND lp.user_id = ?

        WHERE l.id = ?

        ${ownershipCondition}

        LIMIT 1
      `,
      queryValues
    );

  if (
    lessonRows.length === 0
  ) {
    return null;
  }

  const lesson =
    lessonRows[0];

  const [courseLessons] =
    await pool.execute(
      `
        SELECT
          l.id,
          l.title,
          l.lesson_order,
          l.module_id,
          cm.module_order,
          cm.title AS module_title

        FROM lessons l

        INNER JOIN course_modules cm
          ON cm.id = l.module_id

        WHERE cm.course_id = ?

        ORDER BY
          cm.module_order ASC,
          l.lesson_order ASC
      `,
      [lesson.course_id]
    );

  const currentIndex =
    courseLessons.findIndex(
      (courseLesson) =>
        Number(
          courseLesson.id
        ) === Number(lessonId)
    );

  const previousLesson =
    currentIndex > 0
      ? courseLessons[
          currentIndex - 1
        ]
      : null;

  const nextLesson =
    currentIndex >= 0 &&
    currentIndex <
      courseLessons.length - 1
      ? courseLessons[
          currentIndex + 1
        ]
      : null;

  return {
    ...lesson,

    lessonPosition:
      currentIndex >= 0
        ? currentIndex + 1
        : 1,

    totalCourseLessons:
      courseLessons.length,

    previousLesson,

    nextLesson,
  };
};


module.exports = {
  getLessonsByUserId,
  getLessonById,
};