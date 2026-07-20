const {
  pool,
} = require("../config/db");


const getQuizzesByUserId =
  async ({
    userId,
    courseId = null,
  }) => {
    const queryValues = [
      userId,
    ];

    let courseCondition =
      "";

    if (
      Number.isInteger(
        courseId
      ) &&
      courseId > 0
    ) {
      courseCondition =
        "AND c.id = ?";

      queryValues.push(
        courseId
      );
    }

    const [quizzes] =
      await pool.execute(
        `
          SELECT
            q.id,
            q.course_id,
            q.module_id,
            q.title,
            q.description,
            q.quiz_type,
            q.passing_percentage,
            q.time_limit_minutes,
            q.created_at,

            cm.title
              AS module_title,
            cm.module_order,

            c.title
              AS course_title,
            c.description
              AS course_description,
            c.category
              AS course_category,
            c.level
              AS course_level,
            c.language
              AS course_language,

            (
              SELECT COUNT(*)
              FROM quiz_questions qq
              WHERE qq.quiz_id = q.id
            ) AS question_count

          FROM quizzes q

          INNER JOIN course_modules cm
            ON cm.id = q.module_id

          INNER JOIN courses c
            ON c.id = q.course_id

          WHERE c.user_id = ?

          ${courseCondition}

          ORDER BY
            c.created_at DESC,
            cm.module_order ASC,
            q.id ASC
        `,
        queryValues
      );

    return quizzes;
  };


const getQuizById = async ({
  quizId,
  userId,
}) => {
  const [quizRows] =
    await pool.execute(
      `
        SELECT
          q.id,
          q.course_id,
          q.module_id,
          q.title,
          q.description,
          q.quiz_type,
          q.passing_percentage,
          q.time_limit_minutes,
          q.created_at,

          cm.title
            AS module_title,
          cm.module_order,

          c.user_id,
          c.title
            AS course_title,
          c.description
            AS course_description,
          c.category
            AS course_category,
          c.level
            AS course_level,
          c.language
            AS course_language

        FROM quizzes q

        INNER JOIN course_modules cm
          ON cm.id = q.module_id

        INNER JOIN courses c
          ON c.id = q.course_id

        WHERE q.id = ?
          AND c.user_id = ?

        LIMIT 1
      `,
      [
        quizId,
        userId,
      ]
    );

  if (
    quizRows.length === 0
  ) {
    return null;
  }

  const quiz =
    quizRows[0];

  const [questions] =
    await pool.execute(
      `
        SELECT
          id,
          quiz_id,
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

        ORDER BY
          question_order ASC,
          id ASC
      `,
      [quizId]
    );

  quiz.questions =
    questions;

  return quiz;
};


module.exports = {
  getQuizzesByUserId,
  getQuizById,
};