const PDFDocument = require(
  "pdfkit"
);

const safeText = (
  value,
  fallback = ""
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  const normalizedText =
    String(value).trim();

  return (
    normalizedText ||
    fallback
  );
};

const sanitizeFileName = (
  value
) => {
  const normalizedName =
    safeText(
      value,
      "skillverse-course"
    )
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
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return (
    normalizedName ||
    "skillverse-course"
  );
};

const formatBoolean = (
  value
) => {
  return value
    ? "Yes"
    : "No";
};

const addPageNumber = (
  document
) => {
  const pageRange =
    document.bufferedPageRange();

  for (
    let pageIndex = 0;
    pageIndex <
    pageRange.count;
    pageIndex += 1
  ) {
    document.switchToPage(
      pageIndex
    );

    const pageNumber =
      pageIndex + 1;

    document
      .fontSize(9)
      .fillColor(
        "#64748b"
      )
      .text(
        `SkillVerse Course Notes • Page ${pageNumber}`,
        50,
        document.page.height -
          40,
        {
          align: "center",
          width:
            document.page.width -
            100,
        }
      );
  }
};

const addSectionTitle = (
  document,
  title,
  options = {}
) => {
  const {
    fontSize = 18,
    topGap = 14,
    bottomGap = 8,
  } = options;

  document
    .moveDown(
      topGap / 10
    )
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      fontSize
    )
    .fillColor(
      "#0f172a"
    )
    .text(
      safeText(title)
    );

  document
    .moveDown(
      bottomGap / 10
    );
};

const addParagraph = (
  document,
  text,
  options = {}
) => {
  const {
    fontSize = 11,
    color = "#334155",
    gap = 0.7,
    indent = 0,
  } = options;

  const normalizedText =
    safeText(text);

  if (!normalizedText) {
    return;
  }

  document
    .font(
      "Helvetica"
    )
    .fontSize(
      fontSize
    )
    .fillColor(
      color
    )
    .text(
      normalizedText,
      {
        align: "left",
        lineGap: 3,
        indent,
      }
    )
    .moveDown(
      gap
    );
};

const addLabelValue = (
  document,
  label,
  value
) => {
  const normalizedValue =
    safeText(
      value,
      "Not available"
    );

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(10)
    .fillColor(
      "#475569"
    )
    .text(
      `${label}: `,
      {
        continued: true,
      }
    )
    .font(
      "Helvetica"
    )
    .fillColor(
      "#0f172a"
    )
    .text(
      normalizedValue
    )
    .moveDown(0.35);
};

const addCodeBlock = (
  document,
  code,
  language
) => {
  const normalizedCode =
    safeText(code);

  if (!normalizedCode) {
    return;
  }

  const blockTop =
    document.y;

  const availableWidth =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right;

  const codeHeight =
    document.heightOfString(
      normalizedCode,
      {
        width:
          availableWidth - 24,
        lineGap: 2,
      }
    ) + 44;

  if (
    blockTop +
      codeHeight >
    document.page.height -
      document.page.margins.bottom -
      50
  ) {
    document.addPage();
  }

  const finalTop =
    document.y;

  document
    .roundedRect(
      document.page.margins.left,
      finalTop,
      availableWidth,
      codeHeight,
      8
    )
    .fill(
      "#0f172a"
    );

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(9)
    .fillColor(
      "#cbd5e1"
    )
    .text(
      safeText(
        language,
        "Code example"
      ),
      document.page.margins.left +
        12,
      finalTop + 10
    );

  document
    .font(
      "Courier"
    )
    .fontSize(9)
    .fillColor(
      "#f8fafc"
    )
    .text(
      normalizedCode,
      document.page.margins.left +
        12,
      finalTop + 28,
      {
        width:
          availableWidth - 24,
        lineGap: 2,
      }
    );

  document.y =
    finalTop +
    codeHeight +
    12;
};

const addQuestion = (
  document,
  question,
  questionIndex
) => {
  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(11)
    .fillColor(
      "#0f172a"
    )
    .text(
      `${questionIndex + 1}. ${safeText(
        question.question,
        "Untitled question"
      )}`
    )
    .moveDown(0.4);

  const optionEntries = [
    [
      "A",
      question.option_a ||
        question.options?.A,
    ],
    [
      "B",
      question.option_b ||
        question.options?.B,
    ],
    [
      "C",
      question.option_c ||
        question.options?.C,
    ],
    [
      "D",
      question.option_d ||
        question.options?.D,
    ],
  ];

  optionEntries.forEach(
    ([
      optionKey,
      optionValue,
    ]) => {
      document
        .font(
          "Helvetica"
        )
        .fontSize(10)
        .fillColor(
          "#334155"
        )
        .text(
          `${optionKey}. ${safeText(
            optionValue,
            "Not available"
          )}`,
          {
            indent: 12,
          }
        )
        .moveDown(0.18);
    }
  );

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(10)
    .fillColor(
      "#166534"
    )
    .text(
      `Correct answer: ${safeText(
        question.correct_option ||
          question.correctOption,
        "Not available"
      )}`
    )
    .moveDown(0.25);

  if (
    safeText(
      question.explanation
    )
  ) {
    document
      .font(
        "Helvetica"
      )
      .fontSize(10)
      .fillColor(
        "#475569"
      )
      .text(
        `Explanation: ${safeText(
          question.explanation
        )}`,
        {
          lineGap: 2,
        }
      )
      .moveDown(0.8);
  }
};

const writeCourseNotesPdf = ({
  response,
  course,
  user,
}) => {
  if (!response) {
    throw new Error(
      "PDF response stream is required"
    );
  }

  if (!course) {
    throw new Error(
      "Course data is required"
    );
  }

  const document =
    new PDFDocument({
      size: "A4",

      margins: {
        top: 55,
        bottom: 60,
        left: 55,
        right: 55,
      },

      bufferPages: true,

      info: {
        Title:
          safeText(
            course.title,
            "SkillVerse Course Notes"
          ),

        Author:
          safeText(
            user?.full_name ||
              user?.fullName ||
              user?.name,
            "SkillVerse Learner"
          ),

        Subject:
          "AI-generated SkillVerse course notes",

        Creator:
          "SkillVerse",
      },
    });

  const fileName =
    `${sanitizeFileName(
      course.title
    )}-notes.pdf`;

  response.status(200);

  response.setHeader(
    "Content-Type",
    "application/pdf"
  );

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`
  );

  response.setHeader(
    "Cache-Control",
    "no-store"
  );

  document.pipe(
    response
  );

  document
    .rect(
      0,
      0,
      document.page.width,
      190
    )
    .fill(
      "#4f46e5"
    );

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(15)
    .fillColor(
      "#e0e7ff"
    )
    .text(
      "SKILLVERSE",
      55,
      48
    );

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(28)
    .fillColor(
      "#ffffff"
    )
    .text(
      safeText(
        course.title,
        "Course Notes"
      ),
      55,
      82,
      {
        width:
          document.page.width -
          110,
      }
    );

  document
    .font(
      "Helvetica"
    )
    .fontSize(12)
    .fillColor(
      "#e0e7ff"
    )
    .text(
      safeText(
        course.description,
        "Complete AI-generated learning notes."
      ),
      55,
      128,
      {
        width:
          document.page.width -
          110,
        lineGap: 3,
      }
    );

  document.y = 220;

  addSectionTitle(
    document,
    "Course Overview",
    {
      topGap: 0,
      fontSize: 20,
    }
  );

  addLabelValue(
    document,
    "Learner",
    user?.full_name ||
      user?.fullName ||
      user?.name
  );

  addLabelValue(
    document,
    "Email",
    user?.email
  );

  addLabelValue(
    document,
    "Category",
    course.category
  );

  addLabelValue(
    document,
    "Difficulty",
    course.level
  );

  addLabelValue(
    document,
    "Language",
    course.language
  );

  addLabelValue(
    document,
    "Estimated duration",
    course.estimated_duration ||
      course.estimatedDuration
  );

  addLabelValue(
    document,
    "Modules",
    course.total_modules ||
      course.modules?.length ||
      0
  );

  addLabelValue(
    document,
    "Lessons",
    course.total_lessons ||
      course.modules?.reduce(
        (
          total,
          module
        ) =>
          total +
          (
            module.lessons
              ?.length ||
            0
          ),
        0
      ) ||
      0
  );

  addLabelValue(
    document,
    "AI generated",
    formatBoolean(
      Boolean(
        course.generated_by_ai ??
          course.generatedByAi
      )
    )
  );

  if (
    Array.isArray(
      course.modules
    ) &&
    course.modules.length >
      0
  ) {
    addSectionTitle(
      document,
      "Course Roadmap",
      {
        fontSize: 20,
      }
    );

    course.modules.forEach(
      (
        module,
        moduleIndex
      ) => {
        document
          .font(
            "Helvetica-Bold"
          )
          .fontSize(12)
          .fillColor(
            "#4338ca"
          )
          .text(
            `Module ${moduleIndex + 1}: ${safeText(
              module.title,
              "Untitled Module"
            )}`
          );

        if (
          safeText(
            module.description
          )
        ) {
          addParagraph(
            document,
            module.description,
            {
              fontSize: 10,
              gap: 0.5,
              indent: 10,
            }
          );
        }

        document.moveDown(0.3);
      }
    );
  }

  (
    course.modules ||
    []
  ).forEach(
    (
      module,
      moduleIndex
    ) => {
      document.addPage();

      document
        .font(
          "Helvetica-Bold"
        )
        .fontSize(11)
        .fillColor(
          "#6366f1"
        )
        .text(
          `MODULE ${moduleIndex + 1}`
        );

      document
        .moveDown(0.3)
        .font(
          "Helvetica-Bold"
        )
        .fontSize(24)
        .fillColor(
          "#0f172a"
        )
        .text(
          safeText(
            module.title,
            `Module ${moduleIndex + 1}`
          )
        )
        .moveDown(0.5);

      addParagraph(
        document,
        module.description,
        {
          fontSize: 11,
          color:
            "#475569",
        }
      );

      addLabelValue(
        document,
        "Estimated duration",
        module.estimated_duration ||
          module.estimatedDuration
      );

      (
        module.lessons ||
        []
      ).forEach(
        (
          lesson,
          lessonIndex
        ) => {
          addSectionTitle(
            document,
            `Lesson ${lessonIndex + 1}: ${safeText(
              lesson.title,
              "Untitled Lesson"
            )}`,
            {
              fontSize: 17,
              topGap: 16,
            }
          );

          if (
            safeText(
              lesson.description
            )
          ) {
            addParagraph(
              document,
              lesson.description,
              {
                fontSize: 10,
                color:
                  "#64748b",
              }
            );
          }

          addLabelValue(
            document,
            "Lesson type",
            lesson.lesson_type ||
              lesson.lessonType
          );

          addLabelValue(
            document,
            "Duration",
            `${
              lesson.duration_minutes ||
              lesson.durationMinutes ||
              0
            } minutes`
          );

          if (
            safeText(
              lesson.content
            )
          ) {
            document
              .font(
                "Helvetica-Bold"
              )
              .fontSize(11)
              .fillColor(
                "#1e293b"
              )
              .text(
                "Lesson Content"
              )
              .moveDown(0.35);

            addParagraph(
              document,
              lesson.content
            );
          }

          if (
            safeText(
              lesson.summary
            )
          ) {
            document
              .font(
                "Helvetica-Bold"
              )
              .fontSize(11)
              .fillColor(
                "#1e293b"
              )
              .text(
                "Summary"
              )
              .moveDown(0.35);

            addParagraph(
              document,
              lesson.summary,
              {
                color:
                  "#475569",
              }
            );
          }

          if (
            safeText(
              lesson.code_example ||
                lesson.codeExample
            )
          ) {
            document
              .font(
                "Helvetica-Bold"
              )
              .fontSize(11)
              .fillColor(
                "#1e293b"
              )
              .text(
                "Code Example"
              )
              .moveDown(0.5);

            addCodeBlock(
              document,
              lesson.code_example ||
                lesson.codeExample,
              lesson.code_language ||
                lesson.codeLanguage
            );
          }

          if (
            safeText(
              lesson.practice_task ||
                lesson.practiceTask
            )
          ) {
            document
              .font(
                "Helvetica-Bold"
              )
              .fontSize(11)
              .fillColor(
                "#1e293b"
              )
              .text(
                "Practice Task"
              )
              .moveDown(0.35);

            addParagraph(
              document,
              lesson.practice_task ||
                lesson.practiceTask,
              {
                color:
                  "#7c2d12",
              }
            );
          }

          if (
            safeText(
              lesson.youtube_search_query ||
                lesson.youtubeSearchQuery
            )
          ) {
            addLabelValue(
              document,
              "Suggested video search",
              lesson.youtube_search_query ||
                lesson.youtubeSearchQuery
            );
          }
        }
      );

      if (
        module.quiz
      ) {
        addSectionTitle(
          document,
          `Module Quiz: ${safeText(
            module.quiz.title,
            `${module.title} Quiz`
          )}`,
          {
            fontSize: 18,
            topGap: 18,
          }
        );

        addParagraph(
          document,
          module.quiz.description,
          {
            color:
              "#475569",
          }
        );

        addLabelValue(
          document,
          "Passing percentage",
          `${
            module.quiz
              .passing_percentage ||
            module.quiz
              .passingPercentage ||
            60
          }%`
        );

        addLabelValue(
          document,
          "Time limit",
          `${
            module.quiz
              .time_limit_minutes ||
            module.quiz
              .timeLimitMinutes ||
            10
          } minutes`
        );

        (
          module.quiz
            .questions ||
          []
        ).forEach(
          (
            question,
            questionIndex
          ) => {
            addQuestion(
              document,
              question,
              questionIndex
            );
          }
        );
      }
    }
  );

  document.addPage();

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(26)
    .fillColor(
      "#4f46e5"
    )
    .text(
      "Keep Learning",
      {
        align:
          "center",
      }
    )
    .moveDown(0.8);

  document
    .font(
      "Helvetica"
    )
    .fontSize(12)
    .fillColor(
      "#475569"
    )
    .text(
      "These notes were generated for your SkillVerse course. Review the lessons, complete the practice tasks, and test your knowledge using each module quiz.",
      {
        align:
          "center",
        lineGap: 4,
      }
    )
    .moveDown(1);

  document
    .font(
      "Helvetica-Bold"
    )
    .fontSize(12)
    .fillColor(
      "#0f172a"
    )
    .text(
      "SkillVerse — Learn smarter with AI",
      {
        align:
          "center",
      }
    );

  addPageNumber(
    document
  );

  document.end();
};

module.exports = {
  writeCourseNotesPdf,
};