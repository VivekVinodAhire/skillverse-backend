const { pool } = require("../config/db");

/*
  Creates:
  1. Course
  2. Modules
  3. Lessons
  4. Module quizzes
  5. Quiz questions

  Everything is saved inside one transaction.
*/

const createCompleteCourse = async (
  courseData
) => {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const slug = createSlug(
      courseData.title
    );

    const totalModules =
      courseData.modules?.length || 0;

    const totalLessons =
      courseData.modules?.reduce(
        (total, module) =>
          total +
          (module.lessons?.length || 0),
        0
      ) || 0;

    /*
      Insert course
    */

    const [courseResult] =
      await connection.execute(
        `
          INSERT INTO courses (
            user_id,
            title,
            slug,
            description,
            category,
            level,
            language,
            thumbnail_url,
            estimated_duration,
            total_modules,
            total_lessons,
            status,
            generated_by_ai
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          courseData.userId || null,
          courseData.title,
          `${slug}-${Date.now()}`,
          courseData.description || null,
          courseData.category || null,
          courseData.level || "Beginner",
          courseData.language || "English",
          courseData.thumbnailUrl || null,
          courseData.estimatedDuration ||
            null,
          totalModules,
          totalLessons,
          courseData.status || "published",
          courseData.generatedByAi ??
            true,
        ]
      );

    const courseId =
      courseResult.insertId;

    /*
      Insert every module
    */

    for (
      let moduleIndex = 0;
      moduleIndex <
      courseData.modules.length;
      moduleIndex += 1
    ) {
      const module =
        courseData.modules[moduleIndex];

      const [moduleResult] =
        await connection.execute(
          `
            INSERT INTO course_modules (
              course_id,
              title,
              description,
              module_order,
              estimated_duration
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            courseId,
            module.title,
            module.description || null,
            moduleIndex + 1,
            module.estimatedDuration ||
              null,
          ]
        );

      const moduleId =
        moduleResult.insertId;

      /*
        Insert module lessons
      */

      const lessons =
        module.lessons || [];

      for (
        let lessonIndex = 0;
        lessonIndex < lessons.length;
        lessonIndex += 1
      ) {
        const lesson =
          lessons[lessonIndex];

        await connection.execute(
          `
            INSERT INTO lessons (
              module_id,
              title,
              description,
              content,
              lesson_order,
              lesson_type,
              duration_minutes,
              youtube_video_id,
              youtube_video_url,
              youtube_search_query,
              code_language,
              code_example,
              practice_task,
              summary
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?
            )
          `,
          [
            moduleId,
            lesson.title,
            lesson.description || null,
            lesson.content || null,
            lessonIndex + 1,
            lesson.lessonType || "video",
            lesson.durationMinutes || 10,
            lesson.youtubeVideoId ||
              null,
            lesson.youtubeVideoUrl ||
              null,
            lesson.youtubeSearchQuery ||
              null,
            lesson.codeLanguage || null,
            lesson.codeExample || null,
            lesson.practiceTask || null,
            lesson.summary || null,
          ]
        );
      }

      /*
        Insert module quiz
      */

      if (module.quiz) {
        const [quizResult] =
          await connection.execute(
            `
              INSERT INTO quizzes (
                course_id,
                module_id,
                title,
                description,
                quiz_type,
                passing_percentage,
                time_limit_minutes
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              courseId,
              moduleId,
              module.quiz.title ||
                `${module.title} Quiz`,
              module.quiz.description ||
                null,
              "module",
              module.quiz
                .passingPercentage || 60,
              module.quiz
                .timeLimitMinutes || 10,
            ]
          );

        const quizId =
          quizResult.insertId;

        const questions =
          module.quiz.questions || [];

        for (
          let questionIndex = 0;
          questionIndex <
          questions.length;
          questionIndex += 1
        ) {
          const question =
            questions[questionIndex];

          await connection.execute(
            `
              INSERT INTO quiz_questions (
                quiz_id,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_option,
                explanation,
                question_order
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              quizId,
              question.question,
              question.options.A,
              question.options.B,
              question.options.C,
              question.options.D,
              question.correctOption,
              question.explanation || null,
              questionIndex + 1,
            ]
          );
        }
      }
    }

    await connection.commit();

    return {
      courseId,
      totalModules,
      totalLessons,
    };
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
};


/*
  Get all courses
*/

const getAllCourses = async () => {
  const [courses] =
    await pool.execute(
      `
        SELECT
          id,
          title,
          slug,
          description,
          category,
          level,
          language,
          thumbnail_url,
          estimated_duration,
          total_modules,
          total_lessons,
          status,
          generated_by_ai,
          created_at
        FROM courses
        ORDER BY created_at DESC
      `
    );

  return courses;
};


/*
  Get complete course:
  Course → Modules → Lessons → Quiz
*/

const getCompleteCourseById = async (
  courseId
) => {
  const [courseRows] =
    await pool.execute(
      `
        SELECT *
        FROM courses
        WHERE id = ?
        LIMIT 1
      `,
      [courseId]
    );

  if (courseRows.length === 0) {
    return null;
  }

  const course = courseRows[0];

  const [modules] =
    await pool.execute(
      `
        SELECT *
        FROM course_modules
        WHERE course_id = ?
        ORDER BY module_order ASC
      `,
      [courseId]
    );

  for (const module of modules) {
    const [lessons] =
      await pool.execute(
        `
          SELECT *
          FROM lessons
          WHERE module_id = ?
          ORDER BY lesson_order ASC
        `,
        [module.id]
      );

    const [quizRows] =
      await pool.execute(
        `
          SELECT *
          FROM quizzes
          WHERE module_id = ?
          AND quiz_type = 'module'
          LIMIT 1
        `,
        [module.id]
      );

    let quiz = null;

    if (quizRows.length > 0) {
      quiz = quizRows[0];

      const [questions] =
        await pool.execute(
          `
            SELECT
              id,
              question,
              option_a,
              option_b,
              option_c,
              option_d,
              correct_option,
              explanation,
              question_order
            FROM quiz_questions
            WHERE quiz_id = ?
            ORDER BY question_order ASC
          `,
          [quiz.id]
        );

      quiz.questions = questions;
    }

    module.lessons = lessons;
    module.quiz = quiz;
  }

  course.modules = modules;

  return course;
};
/*
  Get only the logged-in user's AI-created courses
*/

const getCoursesByUserId = async (userId) => {
  const [courses] = await pool.execute(
    `
      SELECT
        c.id,
        c.user_id,
        c.title,
        c.slug,
        c.description,
        c.category,
        c.level,
        c.language,
        c.thumbnail_url,
        c.estimated_duration,
        c.total_modules,
        c.total_lessons,
        c.status,
        c.generated_by_ai,
        c.created_at,

        COALESCE(
          (
            SELECT COUNT(*)
            FROM lesson_progress lp
            WHERE lp.course_id = c.id
              AND lp.user_id = ?
              AND lp.is_completed = 1
          ),
          0
        ) AS completed_lessons

      FROM courses c

      WHERE c.user_id = ?

      ORDER BY c.created_at DESC
    `,
    [userId, userId]
  );

  return courses.map((course) => {
    const totalLessons =
      Number(course.total_lessons) || 0;

    const completedLessons =
      Number(course.completed_lessons) || 0;

    const progressPercentage =
      totalLessons > 0
        ? Math.round(
            (completedLessons / totalLessons) *
              100
          )
        : 0;

    return {
      ...course,

      total_lessons: totalLessons,

      completed_lessons:
        completedLessons,

      progress_percentage:
        progressPercentage,

      learning_status:
        progressPercentage >= 100
          ? "Completed"
          : progressPercentage > 0
            ? "In Progress"
            : "Not Started",
    };
  });
};


/*
  Delete only the user's own course
*/

const deleteCourseByUserId = async ({
  courseId,
  userId,
}) => {
  const [result] = await pool.execute(
    `
      DELETE FROM courses
      WHERE id = ?
        AND user_id = ?
    `,
    [courseId, userId]
  );

  return result.affectedRows > 0;
};

const createSlug = (value) => {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};


module.exports = {
  createCompleteCourse,
  getAllCourses,
  getCompleteCourseById,
  getCoursesByUserId,
  deleteCourseByUserId,
};