const PDFDocument = require(
  "pdfkit"
);

const fs = require(
  "fs"
);

const path = require(
  "path"
);


const PAGE_MARGIN = 54;

const PRIMARY_COLOR =
  "#4f46e5";

const DARK_COLOR =
  "#172033";

const MUTED_COLOR =
  "#64748b";

const LIGHT_BACKGROUND =
  "#f6f7fb";

const BORDER_COLOR =
  "#e2e8f0";


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

  const normalizedValue =
    String(value).trim();

  return (
    normalizedValue ||
    fallback
  );
};


const createFileSlug = (
  value
) => {
  const slug =
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
        /^-|-$/g,
        ""
      );

  return (
    slug ||
    "skillverse-course"
  );
};


const findAvailableFont = (
  possiblePaths
) => {
  for (
    const fontPath of possiblePaths
  ) {
    if (
      fontPath &&
      fs.existsSync(
        fontPath
      )
    ) {
      return fontPath;
    }
  }

  return null;
};


const registerDocumentFonts = (
  document
) => {
  const regularFontPath =
    findAvailableFont([
      process.env
        .PDF_FONT_PATH,

      "C:/Windows/Fonts/Nirmala.ttf",

      "C:/Windows/Fonts/NirmalaUI.ttf",

      "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",

      "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",

      path.join(
        __dirname,
        "../assets/fonts/NotoSans-Regular.ttf"
      ),
    ]);

  const boldFontPath =
    findAvailableFont([
      process.env
        .PDF_BOLD_FONT_PATH,

      "C:/Windows/Fonts/NirmalaB.ttf",

      "C:/Windows/Fonts/NirmalaUIBold.ttf",

      "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",

      "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf",

      path.join(
        __dirname,
        "../assets/fonts/NotoSans-Bold.ttf"
      ),
    ]);

  if (regularFontPath) {
    document.registerFont(
      "SkillVerseRegular",
      regularFontPath
    );
  }

  if (boldFontPath) {
    document.registerFont(
      "SkillVerseBold",
      boldFontPath
    );
  } else if (
    regularFontPath
  ) {
    document.registerFont(
      "SkillVerseBold",
      regularFontPath
    );
  }

  return {
    regular:
      regularFontPath
        ? "SkillVerseRegular"
        : "Helvetica",

    bold:
      boldFontPath ||
      regularFontPath
        ? "SkillVerseBold"
        : "Helvetica-Bold",

    code:
      "Courier",
  };
};


const addPageHeader = ({
  document,
  fonts,
}) => {
  const top =
    25;

  document
    .font(
      fonts.bold
    )
    .fontSize(11)
    .fillColor(
      PRIMARY_COLOR
    )
    .text(
      "SkillVerse",
      PAGE_MARGIN,
      top,
      {
        continued: true,
      }
    );

  document
    .font(
      fonts.regular
    )
    .fillColor(
      MUTED_COLOR
    )
    .text(
      "  |  AI Course Notes"
    );

  document
    .moveTo(
      PAGE_MARGIN,
      43
    )
    .lineTo(
      document.page.width -
        PAGE_MARGIN,
      43
    )
    .strokeColor(
      BORDER_COLOR
    )
    .lineWidth(0.7)
    .stroke();

  document.y =
    58;
};


const ensurePageSpace = ({
  document,
  fonts,
  requiredHeight = 100,
}) => {
  const availableBottom =
    document.page.height -
    PAGE_MARGIN -
    35;

  if (
    document.y +
      requiredHeight >
    availableBottom
  ) {
    document.addPage();

    addPageHeader({
      document,
      fonts,
    });
  }
};


const addSectionTitle = ({
  document,
  fonts,
  title,
  subtitle,
}) => {
  ensurePageSpace({
    document,
    fonts,
    requiredHeight: 90,
  });

  document
    .moveDown(0.5)
    .font(
      fonts.bold
    )
    .fontSize(17)
    .fillColor(
      DARK_COLOR
    )
    .text(
      safeText(title)
    );

  if (subtitle) {
    document
      .moveDown(0.25)
      .font(
        fonts.regular
      )
      .fontSize(9.5)
      .fillColor(
        MUTED_COLOR
      )
      .text(
        safeText(subtitle)
      );
  }

  document
    .moveDown(0.6)
    .moveTo(
      PAGE_MARGIN,
      document.y
    )
    .lineTo(
      document.page.width -
        PAGE_MARGIN,
      document.y
    )
    .strokeColor(
      BORDER_COLOR
    )
    .lineWidth(0.7)
    .stroke()
    .moveDown(0.8);
};


const addLabelValue = ({
  document,
  fonts,
  label,
  value,
}) => {
  document
    .font(
      fonts.bold
    )
    .fontSize(9)
    .fillColor(
      MUTED_COLOR
    )
    .text(
      `${safeText(label)}: `,
      {
        continued: true,
      }
    )
    .font(
      fonts.regular
    )
    .fillColor(
      DARK_COLOR
    )
    .text(
      safeText(
        value,
        "-"
      )
    );
};


const addInformationBox = ({
  document,
  fonts,
  title,
  text,
  accentColor =
    PRIMARY_COLOR,
}) => {
  const content =
    safeText(text);

  if (!content) {
    return;
  }

  const availableWidth =
    document.page.width -
    PAGE_MARGIN * 2;

  const textHeight =
    document.heightOfString(
      content,
      {
        width:
          availableWidth -
          32,

        lineGap: 3,
      }
    );

  const boxHeight =
    Math.max(
      68,
      textHeight + 47
    );

  ensurePageSpace({
    document,
    fonts,
    requiredHeight:
      boxHeight + 20,
  });

  const startY =
    document.y;

  document
    .roundedRect(
      PAGE_MARGIN,
      startY,
      availableWidth,
      boxHeight,
      9
    )
    .fillColor(
      LIGHT_BACKGROUND
    )
    .fill();

  document
    .rect(
      PAGE_MARGIN,
      startY,
      4,
      boxHeight
    )
    .fillColor(
      accentColor
    )
    .fill();

  document
    .font(
      fonts.bold
    )
    .fontSize(10.5)
    .fillColor(
      accentColor
    )
    .text(
      safeText(title),
      PAGE_MARGIN + 17,
      startY + 13,
      {
        width:
          availableWidth -
          32,
      }
    );

  document
    .font(
      fonts.regular
    )
    .fontSize(9.5)
    .fillColor(
      DARK_COLOR
    )
    .text(
      content,
      PAGE_MARGIN + 17,
      startY + 32,
      {
        width:
          availableWidth -
          32,

        lineGap: 3,
      }
    );

  document.y =
    startY +
    boxHeight +
    12;
};


const addCodeBlock = ({
  document,
  fonts,
  code,
  language,
}) => {
  const codeText =
    safeText(code);

  if (!codeText) {
    return;
  }

  const availableWidth =
    document.page.width -
    PAGE_MARGIN * 2;

  const textHeight =
    document.heightOfString(
      codeText,
      {
        width:
          availableWidth -
          30,

        lineGap: 2,
      }
    );

  const maximumHeight =
    document.page.height -
    PAGE_MARGIN * 2 -
    90;

  if (
    textHeight + 55 >
    maximumHeight
  ) {
    ensurePageSpace({
      document,
      fonts,
      requiredHeight: 160,
    });

    document
      .font(
        fonts.bold
      )
      .fontSize(10)
      .fillColor(
        "#334155"
      )
      .text(
        `Code Example${
          language
            ? ` - ${language}`
            : ""
        }`
      )
      .moveDown(0.4);

    document
      .font(
        fonts.code
      )
      .fontSize(8.2)
      .fillColor(
        "#111827"
      )
      .text(
        codeText,
        {
          width:
            availableWidth,

          lineGap: 2,
        }
      )
      .moveDown(0.8);

    return;
  }

  const boxHeight =
    textHeight + 55;

  ensurePageSpace({
    document,
    fonts,
    requiredHeight:
      boxHeight + 15,
  });

  const startY =
    document.y;

  document
    .roundedRect(
      PAGE_MARGIN,
      startY,
      availableWidth,
      boxHeight,
      8
    )
    .fillColor(
      "#111827"
    )
    .fill();

  document
    .font(
      fonts.bold
    )
    .fontSize(9)
    .fillColor(
      "#a5b4fc"
    )
    .text(
      safeText(
        language,
        "Code Example"
      ),
      PAGE_MARGIN + 15,
      startY + 12,
      {
        width:
          availableWidth -
          30,
      }
    );

  document
    .font(
      fonts.code
    )
    .fontSize(8.2)
    .fillColor(
      "#f8fafc"
    )
    .text(
      codeText,
      PAGE_MARGIN + 15,
      startY + 32,
      {
        width:
          availableWidth -
          30,

        lineGap: 2,
      }
    );

  document.y =
    startY +
    boxHeight +
    12;
};


const addQuizSection = ({
  document,
  fonts,
  quiz,
}) => {
  if (!quiz) {
    return;
  }

  addSectionTitle({
    document,
    fonts,

    title:
      safeText(
        quiz.title,
        "Module Quiz"
      ),

    subtitle:
      `${Number(
        quiz.passing_percentage ||
          60
      )}% passing score | ${
        Number(
          quiz.time_limit_minutes ||
            10
        )
      } minutes`,
  });

  if (
    quiz.description
  ) {
    document
      .font(
        fonts.regular
      )
      .fontSize(9.5)
      .fillColor(
        MUTED_COLOR
      )
      .text(
        safeText(
          quiz.description
        ),
        {
          lineGap: 3,
        }
      )
      .moveDown(0.8);
  }

  const questions =
    Array.isArray(
      quiz.questions
    )
      ? quiz.questions
      : [];

  questions.forEach(
    (
      question,
      questionIndex
    ) => {
      ensurePageSpace({
        document,
        fonts,
        requiredHeight: 175,
      });

      document
        .font(
          fonts.bold
        )
        .fontSize(10.5)
        .fillColor(
          DARK_COLOR
        )
        .text(
          `${questionIndex + 1}. ${safeText(
            question.question
          )}`,
          {
            lineGap: 3,
          }
        )
        .moveDown(0.45);

      const options = [
        [
          "A",
          question.option_a,
        ],

        [
          "B",
          question.option_b,
        ],

        [
          "C",
          question.option_c,
        ],

        [
          "D",
          question.option_d,
        ],
      ];

      options.forEach(
        ([
          optionLetter,
          optionText,
        ]) => {
          document
            .font(
              fonts.regular
            )
            .fontSize(9)
            .fillColor(
              DARK_COLOR
            )
            .text(
              `${optionLetter}. ${safeText(
                optionText
              )}`,
              {
                indent: 12,
                lineGap: 2,
              }
            );
        }
      );

      document
        .moveDown(0.35)
        .font(
          fonts.bold
        )
        .fontSize(8.8)
        .fillColor(
          "#15803d"
        )
        .text(
          `Correct Answer: ${safeText(
            question.correct_option,
            "-"
          )}`
        );

      if (
        question.explanation
      ) {
        document
          .moveDown(0.2)
          .font(
            fonts.regular
          )
          .fontSize(8.8)
          .fillColor(
            MUTED_COLOR
          )
          .text(
            `Explanation: ${safeText(
              question.explanation
            )}`,
            {
              lineGap: 2,
            }
          );
      }

      document
        .moveDown(0.8)
        .moveTo(
          PAGE_MARGIN,
          document.y
        )
        .lineTo(
          document.page.width -
            PAGE_MARGIN,
          document.y
        )
        .strokeColor(
          BORDER_COLOR
        )
        .lineWidth(0.5)
        .stroke()
        .moveDown(0.7);
    }
  );
};


const addPageFooters = ({
  document,
  fonts,
}) => {
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

    const footerY =
      document.page.height -
      34;

    document
      .moveTo(
        PAGE_MARGIN,
        footerY - 8
      )
      .lineTo(
        document.page.width -
          PAGE_MARGIN,
        footerY - 8
      )
      .strokeColor(
        BORDER_COLOR
      )
      .lineWidth(0.5)
      .stroke();

    document
      .font(
        fonts.regular
      )
      .fontSize(8)
      .fillColor(
        MUTED_COLOR
      )
      .text(
        "SkillVerse AI Learning Platform",
        PAGE_MARGIN,
        footerY,
        {
          width: 250,
          align: "left",
        }
      );

    document
      .text(
        `Page ${
          pageIndex + 1
        } of ${
          pageRange.count
        }`,
        document.page.width -
          PAGE_MARGIN -
          150,
        footerY,
        {
          width: 150,
          align: "right",
        }
      );
  }
};


const writeCourseNotesPdf = ({
  response,
  course,
  user,
}) => {
  const document =
    new PDFDocument({
      size: "A4",

      margins: {
        top: 58,
        bottom: 55,
        left:
          PAGE_MARGIN,
        right:
          PAGE_MARGIN,
      },

      bufferPages: true,

      info: {
        Title:
          `${safeText(
            course.title
          )} - Notes`,

        Author:
          "SkillVerse",

        Subject:
          "AI Generated Course Notes",

        Keywords:
          "SkillVerse, Course, Notes, AI Learning",

        Creator:
          "SkillVerse",
      },
    });

  const fonts =
    registerDocumentFonts(
      document
    );

  const fileName =
    `${createFileSlug(
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

  addPageHeader({
    document,
    fonts,
  });

  document.on(
    "pageAdded",
    () => {
      addPageHeader({
        document,
        fonts,
      });
    }
  );

  document
    .moveDown(1.1)
    .font(
      fonts.bold
    )
    .fontSize(10)
    .fillColor(
      PRIMARY_COLOR
    )
    .text(
      "SKILLVERSE COURSE NOTES"
    )
    .moveDown(0.55)
    .fontSize(27)
    .fillColor(
      DARK_COLOR
    )
    .text(
      safeText(
        course.title,
        "Untitled Course"
      ),
      {
        lineGap: 4,
      }
    )
    .moveDown(0.55)
    .font(
      fonts.regular
    )
    .fontSize(11)
    .fillColor(
      MUTED_COLOR
    )
    .text(
      safeText(
        course.description,
        "Complete course notes generated by SkillVerse."
      ),
      {
        lineGap: 4,
      }
    )
    .moveDown(1.2);

  const metadataY =
    document.y;

  const metadataWidth =
    document.page.width -
    PAGE_MARGIN * 2;

  document
    .roundedRect(
      PAGE_MARGIN,
      metadataY,
      metadataWidth,
      137,
      10
    )
    .fillColor(
      LIGHT_BACKGROUND
    )
    .fill();

  document.y =
    metadataY + 17;

  document.x =
    PAGE_MARGIN + 18;

  addLabelValue({
    document,
    fonts,
    label: "Student",
    value:
      user?.full_name ||
      user?.fullName ||
      user?.name ||
      "SkillVerse Learner",
  });

  addLabelValue({
    document,
    fonts,
    label: "Email",
    value:
      user?.email ||
      "-",
  });

  addLabelValue({
    document,
    fonts,
    label: "Category",
    value:
      course.category ||
      "Education",
  });

  addLabelValue({
    document,
    fonts,
    label: "Level",
    value:
      course.level ||
      "Beginner",
  });

  addLabelValue({
    document,
    fonts,
    label: "Language",
    value:
      course.language ||
      "English",
  });

  addLabelValue({
    document,
    fonts,
    label: "Duration",
    value:
      course.estimated_duration ||
      "Self-paced",
  });

  addLabelValue({
    document,
    fonts,
    label: "Course Content",
    value:
      `${Number(
        course.total_modules ||
          course.modules?.length ||
          0
      )} modules | ${Number(
        course.total_lessons ||
          0
      )} lessons`,
  });

  document.y =
    metadataY + 154;

  document.x =
    PAGE_MARGIN;

  document
    .font(
      fonts.regular
    )
    .fontSize(8.8)
    .fillColor(
      MUTED_COLOR
    )
    .text(
      `PDF generated on ${new Date().toLocaleString(
        "en-IN",
        {
          dateStyle: "long",
          timeStyle: "short",
        }
      )}`
    )
    .moveDown(1.2);

  addSectionTitle({
    document,
    fonts,
    title:
      "Course Roadmap",

    subtitle:
      "Modules and lessons included in this course",
  });

  const modules =
    Array.isArray(
      course.modules
    )
      ? course.modules
      : [];

  modules.forEach(
    (
      module,
      moduleIndex
    ) => {
      ensurePageSpace({
        document,
        fonts,
        requiredHeight: 110,
      });

      document
        .font(
          fonts.bold
        )
        .fontSize(13)
        .fillColor(
          PRIMARY_COLOR
        )
        .text(
          `Module ${
            moduleIndex + 1
          }: ${safeText(
            module.title,
            "Untitled Module"
          )}`
        );

      if (
        module.description
      ) {
        document
          .moveDown(0.3)
          .font(
            fonts.regular
          )
          .fontSize(9.5)
          .fillColor(
            MUTED_COLOR
          )
          .text(
            safeText(
              module.description
            ),
            {
              lineGap: 3,
            }
          );
      }

      document
        .moveDown(0.35)
        .font(
          fonts.regular
        )
        .fontSize(8.7)
        .fillColor(
          DARK_COLOR
        )
        .text(
          `${module.lessons?.length || 0} lessons${
            module.estimated_duration
              ? ` | ${module.estimated_duration}`
              : ""
          }`
        )
        .moveDown(0.7);

      const lessons =
        Array.isArray(
          module.lessons
        )
          ? module.lessons
          : [];

      lessons.forEach(
        (
          lesson,
          lessonIndex
        ) => {
          document
            .font(
              fonts.regular
            )
            .fontSize(9)
            .fillColor(
              DARK_COLOR
            )
            .text(
              `• Lesson ${
                lessonIndex + 1
              }: ${safeText(
                lesson.title
              )}`,
              {
                indent: 10,
              }
            );
        }
      );

      document.moveDown(1);
    }
  );

  modules.forEach(
    (
      module,
      moduleIndex
    ) => {
      document.addPage();

      addSectionTitle({
        document,
        fonts,

        title:
          `Module ${
            moduleIndex + 1
          }: ${safeText(
            module.title,
            "Untitled Module"
          )}`,

        subtitle:
          module.description ||
          module.estimated_duration ||
          "",
      });

      const lessons =
        Array.isArray(
          module.lessons
        )
          ? module.lessons
          : [];

      lessons.forEach(
        (
          lesson,
          lessonIndex
        ) => {
          ensurePageSpace({
            document,
            fonts,
            requiredHeight: 145,
          });

          document
            .font(
              fonts.bold
            )
            .fontSize(14)
            .fillColor(
              DARK_COLOR
            )
            .text(
              `Lesson ${
                lessonIndex + 1
              }: ${safeText(
                lesson.title,
                "Untitled Lesson"
              )}`
            )
            .moveDown(0.3);

          document
            .font(
              fonts.regular
            )
            .fontSize(8.8)
            .fillColor(
              MUTED_COLOR
            )
            .text(
              [
                safeText(
                  lesson.lesson_type,
                  "lesson"
                ),

                `${Number(
                  lesson.duration_minutes ||
                    10
                )} minutes`,
              ].join(" | ")
            )
            .moveDown(0.7);

          if (
            lesson.description
          ) {
            document
              .font(
                fonts.regular
              )
              .fontSize(9.5)
              .fillColor(
                MUTED_COLOR
              )
              .text(
                safeText(
                  lesson.description
                ),
                {
                  lineGap: 3,
                }
              )
              .moveDown(0.8);
          }

          if (
            lesson.content
          ) {
            document
              .font(
                fonts.bold
              )
              .fontSize(10.5)
              .fillColor(
                PRIMARY_COLOR
              )
              .text(
                "Lesson Notes"
              )
              .moveDown(0.35)
              .font(
                fonts.regular
              )
              .fontSize(9.6)
              .fillColor(
                DARK_COLOR
              )
              .text(
                safeText(
                  lesson.content
                ),
                {
                  lineGap: 4,
                  align: "justify",
                }
              )
              .moveDown(0.9);
          }

          addCodeBlock({
            document,
            fonts,

            code:
              lesson.code_example,

            language:
              lesson.code_language,
          });

          addInformationBox({
            document,
            fonts,

            title:
              "Practice Task",

            text:
              lesson.practice_task,

            accentColor:
              "#d97706",
          });

          addInformationBox({
            document,
            fonts,

            title:
              "Lesson Summary",

            text:
              lesson.summary,

            accentColor:
              "#059669",
          });

          document
            .moveDown(0.3)
            .moveTo(
              PAGE_MARGIN,
              document.y
            )
            .lineTo(
              document.page.width -
                PAGE_MARGIN,
              document.y
            )
            .strokeColor(
              BORDER_COLOR
            )
            .lineWidth(0.6)
            .stroke()
            .moveDown(1);
        }
      );

      addQuizSection({
        document,
        fonts,
        quiz:
          module.quiz,
      });
    }
  );

  document.addPage();

  addSectionTitle({
    document,
    fonts,

    title:
      "Course Completion Checklist",

    subtitle:
      "Use this checklist while completing your SkillVerse course",
  });

  const checklistItems = [
    "Complete every lesson in the correct module order.",
    "Read the complete lesson content and summary.",
    "Practice the provided code examples and tasks.",
    "Attempt every module quiz.",
    "Review incorrect quiz answers and explanations.",
    "Mark lessons as completed in SkillVerse.",
    "Revise important concepts before completing the course.",
  ];

  checklistItems.forEach(
    (
      item,
      index
    ) => {
      ensurePageSpace({
        document,
        fonts,
        requiredHeight: 40,
      });

      document
        .font(
          fonts.bold
        )
        .fontSize(10)
        .fillColor(
          PRIMARY_COLOR
        )
        .text(
          "□",
          {
            continued: true,
          }
        )
        .font(
          fonts.regular
        )
        .fillColor(
          DARK_COLOR
        )
        .text(
          `  ${index + 1}. ${item}`
        )
        .moveDown(0.55);
    }
  );

  document
    .moveDown(2)
    .font(
      fonts.bold
    )
    .fontSize(16)
    .fillColor(
      PRIMARY_COLOR
    )
    .text(
      "Keep Learning. Keep Growing.",
      {
        align: "center",
      }
    )
    .moveDown(0.4)
    .font(
      fonts.regular
    )
    .fontSize(9.5)
    .fillColor(
      MUTED_COLOR
    )
    .text(
      "Generated by SkillVerse AI Learning Platform",
      {
        align: "center",
      }
    );

  addPageFooters({
    document,
    fonts,
  });

  document.end();

  return fileName;
};


module.exports = {
  writeCourseNotesPdf,
};