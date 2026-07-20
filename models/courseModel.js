const {
  pool,
} = require(
  "../config/db"
);

const createSlug = (
  value
) => {
  const slug =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9\s-]/g,
        ""
      )
      .replace(
        /\s+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      );

  return (
    slug ||
    "skillverse-course"
  );
};

const ensureGenerationJobsTable =
  async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS course_generation_jobs (
        id INT NOT NULL AUTO_INCREMENT,
        course_id INT NULL,
        user_id INT NOT NULL,

        topic VARCHAR(255) NOT NULL,
        level VARCHAR(50) NOT NULL DEFAULT 'Beginner',
        language VARCHAR(50) NOT NULL DEFAULT 'English',

        number_of_modules INT NOT NULL,
        lessons_per_module INT NOT NULL,

        status VARCHAR(50) NOT NULL DEFAULT 'queued',
        stage VARCHAR(100) NULL,
        progress_percentage INT NOT NULL DEFAULT 0,

        current_module INT NOT NULL DEFAULT 0,
        completed_modules INT NOT NULL DEFAULT 0,

        progress_message TEXT NULL,
        outline_json LONGTEXT NULL,
        error_message LONGTEXT NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        completed_at TIMESTAMP NULL DEFAULT NULL,

        PRIMARY KEY (id),

        KEY index_generation_user_id (user_id),
        KEY index_generation_course_id (course_id),
        KEY index_generation_status (status),

        CONSTRAINT fk_generation_job_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,

        CONSTRAINT fk_generation_job_course
          FOREIGN KEY (course_id)
          REFERENCES courses(id)
          ON DELETE CASCADE
      )
    `);
  };

/*
  Create generation job
*/

const createGenerationJob =
  async ({
    userId,
    topic,
    level,
    language,
    numberOfModules,
    lessonsPerModule,
  }) => {
    await ensureGenerationJobsTable();

    const [result] =
      await pool.execute(
        `
          INSERT INTO course_generation_jobs (
            user_id,
            topic,
            level,
            language,
            number_of_modules,
            lessons_per_module,
            status,
            stage,
            progress_percentage,
            progress_message
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          topic,
          level,
          language,
          numberOfModules,
          lessonsPerModule,
          "queued",
          "queued",
          0,
          "Course generation is queued",
        ]
      );

    return result.insertId;
  };

const getGenerationJobById =
  async ({
    jobId,
    userId,
  }) => {
    await ensureGenerationJobsTable();

    const [rows] =
      await pool.execute(
        `
          SELECT *
          FROM course_generation_jobs
          WHERE id = ?
            AND user_id = ?
          LIMIT 1
        `,
        [
          jobId,
          userId,
        ]
      );

    if (
      rows.length === 0
    ) {
      return null;
    }

    const job = rows[0];

    if (
      job.outline_json
    ) {
      try {
        job.outline =
          JSON.parse(
            job.outline_json
          );
      } catch {
        job.outline = null;
      }
    } else {
      job.outline = null;
    }

    return job;
  };

const updateGenerationJob =
  async ({
    jobId,
    userId,
    courseId,
    status,
    stage,
    progressPercentage,
    currentModule,
    completedModules,
    progressMessage,
    outline,
    errorMessage,
    completed = false,
  }) => {
    await ensureGenerationJobsTable();

    const updates = [];
    const values = [];

    const addUpdate = (
      column,
      value
    ) => {
      if (
        value !== undefined
      ) {
        updates.push(
          `${column} = ?`
        );

        values.push(value);
      }
    };

    addUpdate(
      "course_id",
      courseId
    );

    addUpdate(
      "status",
      status
    );

    addUpdate(
      "stage",
      stage
    );

    addUpdate(
      "progress_percentage",
      progressPercentage
    );

    addUpdate(
      "current_module",
      currentModule
    );

    addUpdate(
      "completed_modules",
      completedModules
    );

    addUpdate(
      "progress_message",
      progressMessage
    );

    addUpdate(
      "outline_json",
      outline !== undefined
        ? JSON.stringify(
            outline
          )
        : undefined
    );

    addUpdate(
      "error_message",
      errorMessage
    );

    if (completed) {
      updates.push(
        "completed_at = CURRENT_TIMESTAMP"
      );
    }

    if (
      updates.length === 0
    ) {
      return false;
    }

    values.push(
      jobId,
      userId
    );

    const [result] =
      await pool.execute(
        `
          UPDATE course_generation_jobs
          SET ${updates.join(", ")}
          WHERE id = ?
            AND user_id = ?
        `,
        values
      );

    return (
      result.affectedRows >
      0
    );
  };

/*
  Create draft course immediately
*/

const createCourseDraft =
  async ({
    userId,
    outline,
    numberOfModules,
    lessonsPerModule,
  }) => {
    const title =
      outline.title;

    const slug =
      `${createSlug(
        title
      )}-${Date.now()}`;

    const expectedLessons =
      numberOfModules *
      lessonsPerModule;

    const [result] =
      await pool.execute(
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
          userId,
          title,
          slug,
          outline.description ||
            null,
          outline.category ||
            "Education",
          outline.level ||
            "Beginner",
          outline.language ||
            "English",
          null,
          outline.estimatedDuration ||
            "Self-paced",
          numberOfModules,
          expectedLessons,
          "generating",
          true,
        ]
      );

    return result.insertId;
  };

/*
  Save one generated module atomically
*/

const saveGeneratedModule =
  async ({
    courseId,
    moduleData,
    moduleOrder,
  }) => {
    const connection =
      await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingModules] =
        await connection.execute(
          `
            SELECT id
            FROM course_modules
            WHERE course_id = ?
              AND module_order = ?
            LIMIT 1
          `,
          [
            courseId,
            moduleOrder,
          ]
        );

      if (
        existingModules.length >
        0
      ) {
        await connection.commit();

        return {
          moduleId:
            existingModules[0]
              .id,

          alreadyExists:
            true,
        };
      }

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
            moduleData.title,
            moduleData.description ||
              null,
            moduleOrder,
            moduleData.estimatedDuration ||
              null,
          ]
        );

      const moduleId =
        moduleResult.insertId;

      const lessons =
        moduleData.lessons || [];

      for (
        let lessonIndex = 0;
        lessonIndex <
        lessons.length;
        lessonIndex += 1
      ) {
        const lesson =
          lessons[
            lessonIndex
          ];

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
            lesson.description ||
              null,
            lesson.content ||
              null,
            lessonIndex + 1,
            lesson.lessonType ||
              "video",
            lesson.durationMinutes ||
              10,
            lesson.youtubeVideoId ||
              null,
            lesson.youtubeVideoUrl ||
              null,
            lesson.youtubeSearchQuery ||
              null,
            lesson.codeLanguage ||
              null,
            lesson.codeExample ||
              null,
            lesson.practiceTask ||
              null,
            lesson.summary ||
              null,
          ]
        );
      }

      if (
        moduleData.quiz
      ) {
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
              moduleData.quiz
                .title ||
                `${moduleData.title} Quiz`,
              moduleData.quiz
                .description ||
                null,
              "module",
              moduleData.quiz
                .passingPercentage ||
                60,
              moduleData.quiz
                .timeLimitMinutes ||
                10,
            ]
          );

        const quizId =
          quizResult.insertId;

        const questions =
          moduleData.quiz
            .questions ||
          [];

        for (
          let questionIndex = 0;
          questionIndex <
          questions.length;
          questionIndex += 1
        ) {
          const question =
            questions[
              questionIndex
            ];

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
              question.explanation ||
                null,
              questionIndex + 1,
            ]
          );
        }
      }

      await connection.commit();

      return {
        moduleId,
        alreadyExists:
          false,
      };
    } catch (error) {
      await connection.rollback();

      throw error;
    } finally {
      connection.release();
    }
  };

const getSavedModulesForResume =
  async (
    courseId
  ) => {
    const [modules] =
      await pool.execute(
        `
          SELECT
            id,
            title,
            description,
            module_order,
            estimated_duration
          FROM course_modules
          WHERE course_id = ?
          ORDER BY module_order ASC
        `,
        [
          courseId,
        ]
      );

    return modules.map(
      (module) => ({
        id:
          module.id,

        title:
          module.title,

        description:
          module.description,

        estimatedDuration:
          module.estimated_duration,

        moduleOrder:
          Number(
            module.module_order
          ),

        lessons: [],

        quiz: null,
      })
    );
  };

const finalizeGeneratedCourse =
  async ({
    courseId,
    totalModules,
    totalLessons,
  }) => {
    const [result] =
      await pool.execute(
        `
          UPDATE courses
          SET
            total_modules = ?,
            total_lessons = ?,
            status = 'published'
          WHERE id = ?
        `,
        [
          totalModules,
          totalLessons,
          courseId,
        ]
      );

    return (
      result.affectedRows >
      0
    );
  };

const markCourseGenerationFailed =
  async (
    courseId
  ) => {
    if (!courseId) {
      return false;
    }

    const [result] =
      await pool.execute(
        `
          UPDATE courses
          SET status = 'failed'
          WHERE id = ?
            AND status != 'published'
        `,
        [
          courseId,
        ]
      );

    return (
      result.affectedRows >
      0
    );
  };

/*
  Backward-compatible full transaction
*/

const createCompleteCourse =
  async (
    courseData
  ) => {
    const outline = {
      title:
        courseData.title,

      description:
        courseData.description,

      category:
        courseData.category,

      level:
        courseData.level,

      language:
        courseData.language,

      estimatedDuration:
        courseData.estimatedDuration,
    };

    const numberOfModules =
      courseData.modules
        ?.length ||
      0;

    const lessonsPerModule =
      numberOfModules > 0
        ? Math.max(
            ...courseData.modules.map(
              (module) =>
                module.lessons
                  ?.length ||
                0
            )
          )
        : 0;

    const courseId =
      await createCourseDraft({
        userId:
          courseData.userId,

        outline,

        numberOfModules,

        lessonsPerModule,
      });

    try {
      let totalLessons = 0;

      for (
        let moduleIndex = 0;
        moduleIndex <
        courseData.modules.length;
        moduleIndex += 1
      ) {
        const module =
          courseData.modules[
            moduleIndex
          ];

        await saveGeneratedModule({
          courseId,

          moduleData:
            module,

          moduleOrder:
            moduleIndex + 1,
        });

        totalLessons +=
          module.lessons
            ?.length ||
          0;
      }

      await finalizeGeneratedCourse({
        courseId,

        totalModules:
          numberOfModules,

        totalLessons,
      });

      return {
        courseId,

        totalModules:
          numberOfModules,

        totalLessons,
      };
    } catch (error) {
      await markCourseGenerationFailed(
        courseId
      );

      throw error;
    }
  };

/*
  Course reads
*/

const getAllCourses =
  async () => {
    const [courses] =
      await pool.execute(
        `
          SELECT
            id,
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
            generated_by_ai,
            created_at
          FROM courses
          WHERE status = 'published'
          ORDER BY created_at DESC
        `
      );

    return courses;
  };

const getCompleteCourseById =
  async (
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
        [
          courseId,
        ]
      );

    if (
      courseRows.length === 0
    ) {
      return null;
    }

    const course =
      courseRows[0];

    const [modules] =
      await pool.execute(
        `
          SELECT *
          FROM course_modules
          WHERE course_id = ?
          ORDER BY module_order ASC
        `,
        [
          courseId,
        ]
      );

    for (
      const module of modules
    ) {
      const [lessons] =
        await pool.execute(
          `
            SELECT *
            FROM lessons
            WHERE module_id = ?
            ORDER BY lesson_order ASC
          `,
          [
            module.id,
          ]
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
          [
            module.id,
          ]
        );

      let quiz = null;

      if (
        quizRows.length >
        0
      ) {
        quiz =
          quizRows[0];

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
            [
              quiz.id,
            ]
          );

        quiz.questions =
          questions;
      }

      module.lessons =
        lessons;

      module.quiz =
        quiz;
    }

    course.modules =
      modules;

    return course;
  };

const getCoursesByUserId =
  async (
    userId
  ) => {
    const [courses] =
      await pool.execute(
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
        [
          userId,
          userId,
        ]
      );

    return courses.map(
      (course) => {
        const totalLessons =
          Number(
            course.total_lessons
          ) ||
          0;

        const completedLessons =
          Number(
            course.completed_lessons
          ) ||
          0;

        const progressPercentage =
          totalLessons > 0
            ? Math.round(
                (
                  completedLessons /
                  totalLessons
                ) *
                  100
              )
            : 0;

        return {
          ...course,

          total_lessons:
            totalLessons,

          completed_lessons:
            completedLessons,

          progress_percentage:
            progressPercentage,

          learning_status:
            course.status ===
            "generating"
              ? "Generating"
              : course.status ===
                  "failed"
                ? "Generation Failed"
                : progressPercentage >=
                    100
                  ? "Completed"
                  : progressPercentage >
                      0
                    ? "In Progress"
                    : "Not Started",
        };
      }
    );
  };

const deleteCourseByUserId =
  async ({
    courseId,
    userId,
  }) => {
    const [result] =
      await pool.execute(
        `
          DELETE FROM courses
          WHERE id = ?
            AND user_id = ?
        `,
        [
          courseId,
          userId,
        ]
      );

    return (
      result.affectedRows >
      0
    );
  };

module.exports = {
  createCompleteCourse,
  createGenerationJob,
  getGenerationJobById,
  updateGenerationJob,
  createCourseDraft,
  saveGeneratedModule,
  getSavedModulesForResume,
  finalizeGeneratedCourse,
  markCourseGenerationFailed,
  getAllCourses,
  getCompleteCourseById,
  getCoursesByUserId,
  deleteCourseByUserId,
};