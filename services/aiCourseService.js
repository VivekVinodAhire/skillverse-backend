const ai = require("../config/gemini");

/*
  Gemini model configuration
*/

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.5-flash";

const MAX_RETRIES = 3;

const RETRY_DELAY_MS = 1500;


/*
  Wait utility
*/

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });


/*
  Convert unknown value to safe string
*/

const safeString = (
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


/*
  Normalize positive number
*/

const normalizePositiveNumber = (
  value,
  fallback
) => {
  const number = Number(value);

  if (
    Number.isFinite(number) &&
    number > 0
  ) {
    return Math.round(number);
  }

  return fallback;
};


/*
  Normalize percentage
*/

const normalizePercentage = (
  value
) => {
  const percentage = Number(value);

  if (
    Number.isFinite(percentage) &&
    percentage >= 1 &&
    percentage <= 100
  ) {
    return Math.round(
      percentage
    );
  }

  return 60;
};


/*
  Normalize difficulty level
*/

const normalizeLevel = (
  value
) => {
  const validLevels = [
    "Beginner",
    "Intermediate",
    "Advanced",
  ];

  const normalizedValue =
    safeString(value)
      .toLowerCase();

  const matchedLevel =
    validLevels.find(
      (level) =>
        level.toLowerCase() ===
        normalizedValue
    );

  return (
    matchedLevel ||
    "Beginner"
  );
};


/*
  Normalize lesson type
*/

const normalizeLessonType = (
  value
) => {
  const validTypes = [
    "video",
    "article",
    "code",
    "project",
  ];

  const normalizedValue =
    safeString(
      value,
      "video"
    ).toLowerCase();

  return validTypes.includes(
    normalizedValue
  )
    ? normalizedValue
    : "video";
};


/*
  Clean possible markdown JSON response
*/

const cleanJsonResponse = (
  text
) => {
  let cleanedResponse =
    safeString(text)
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  const firstObjectIndex =
    cleanedResponse.indexOf(
      "{"
    );

  const lastObjectIndex =
    cleanedResponse.lastIndexOf(
      "}"
    );

  if (
    firstObjectIndex !== -1 &&
    lastObjectIndex !== -1 &&
    lastObjectIndex >
      firstObjectIndex
  ) {
    cleanedResponse =
      cleanedResponse.slice(
        firstObjectIndex,
        lastObjectIndex + 1
      );
  }

  return cleanedResponse;
};


/*
  Parse Gemini JSON response
*/

const parseJsonResponse = (
  text,
  responseName
) => {
  const cleanedResponse =
    cleanJsonResponse(text);

  if (!cleanedResponse) {
    throw new Error(
      `${responseName} returned an empty response`
    );
  }

  try {
    return JSON.parse(
      cleanedResponse
    );
  } catch (error) {
    console.error(
      `${responseName} JSON Parse Error:`,
      error.message
    );

    console.error(
      `${responseName} Response Length:`,
      cleanedResponse.length
    );

    console.error(
      `${responseName} Response Ending:`,
      cleanedResponse.slice(
        -800
      )
    );

    throw new Error(
      `${responseName} returned incomplete JSON`
    );
  }
};


/*
  Check whether error can be retried
*/

const isRetryableError = (
  error
) => {
  const status =
    error?.status ||
    error?.response?.status ||
    error?.code;

  const message =
    safeString(
      error?.message
    ).toLowerCase();

  if (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  return (
    message.includes(
      "incomplete"
    ) ||
    message.includes(
      "empty response"
    ) ||
    message.includes(
      "json"
    ) ||
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "temporarily unavailable"
    ) ||
    message.includes(
      "resource exhausted"
    ) ||
    message.includes(
      "rate limit"
    )
  );
};


/*
  Generate structured JSON with retry
*/

const generateStructuredJson =
  async ({
    prompt,
    responseSchema,
    responseName,
    maxOutputTokens = 8192,
    temperature = 0.2,
  }) => {
    let lastError;

    for (
      let attempt = 1;
      attempt <= MAX_RETRIES;
      attempt += 1
    ) {
      try {
        const response =
          await ai.models.generateContent(
            {
              model:
                GEMINI_MODEL,

              contents:
                prompt,

              config: {
                responseMimeType:
                  "application/json",

                responseJsonSchema:
                  responseSchema,

                temperature,

                maxOutputTokens,
              },
            }
          );

        if (!response?.text) {
          throw new Error(
            `${responseName} returned an empty response`
          );
        }

        return parseJsonResponse(
          response.text,
          responseName
        );
      } catch (error) {
        lastError = error;

        console.error(
          `${responseName} attempt ${attempt}/${MAX_RETRIES} failed:`,
          error.message
        );

        if (
          attempt >=
            MAX_RETRIES ||
          !isRetryableError(
            error
          )
        ) {
          break;
        }

        await wait(
          RETRY_DELAY_MS *
            attempt
        );
      }
    }

    throw lastError;
  };


/*
  Course outline JSON schema
*/

const createOutlineSchema = (
  numberOfModules
) => ({
  type: "object",

  additionalProperties: false,

  required: [
    "title",
    "description",
    "category",
    "level",
    "language",
    "estimatedDuration",
    "modules",
  ],

  properties: {
    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    category: {
      type: "string",
    },

    level: {
      type: "string",

      enum: [
        "Beginner",
        "Intermediate",
        "Advanced",
      ],
    },

    language: {
      type: "string",
    },

    estimatedDuration: {
      type: "string",
    },

    modules: {
      type: "array",

      minItems:
        numberOfModules,

      maxItems:
        numberOfModules,

      items: {
        type: "object",

        additionalProperties:
          false,

        required: [
          "title",
          "description",
          "estimatedDuration",
        ],

        properties: {
          title: {
            type: "string",
          },

          description: {
            type: "string",
          },

          estimatedDuration: {
            type: "string",
          },
        },
      },
    },
  },
});


/*
  Module content JSON schema
*/

const createModuleSchema = (
  lessonsPerModule
) => ({
  type: "object",

  additionalProperties: false,

  required: [
    "title",
    "description",
    "estimatedDuration",
    "lessons",
    "quiz",
  ],

  properties: {
    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    estimatedDuration: {
      type: "string",
    },

    lessons: {
      type: "array",

      minItems:
        lessonsPerModule,

      maxItems:
        lessonsPerModule,

      items: {
        type: "object",

        additionalProperties:
          false,

        required: [
          "title",
          "description",
          "content",
          "lessonType",
          "durationMinutes",
          "youtubeSearchQuery",
          "codeLanguage",
          "codeExample",
          "practiceTask",
          "summary",
        ],

        properties: {
          title: {
            type: "string",
          },

          description: {
            type: "string",
          },

          content: {
            type: "string",
          },

          lessonType: {
            type: "string",

            enum: [
              "video",
              "article",
              "code",
              "project",
            ],
          },

          durationMinutes: {
            type: "integer",

            minimum: 5,

            maximum: 90,
          },

          youtubeSearchQuery: {
            type: "string",
          },

          codeLanguage: {
            type: "string",
          },

          codeExample: {
            type: "string",
          },

          practiceTask: {
            type: "string",
          },

          summary: {
            type: "string",
          },
        },
      },
    },

    quiz: {
      type: "object",

      additionalProperties:
        false,

      required: [
        "title",
        "description",
        "passingPercentage",
        "timeLimitMinutes",
        "questions",
      ],

      properties: {
        title: {
          type: "string",
        },

        description: {
          type: "string",
        },

        passingPercentage: {
          type: "integer",

          minimum: 1,

          maximum: 100,
        },

        timeLimitMinutes: {
          type: "integer",

          minimum: 1,

          maximum: 120,
        },

        questions: {
          type: "array",

          minItems: 5,

          maxItems: 5,

          items: {
            type: "object",

            additionalProperties:
              false,

            required: [
              "question",
              "options",
              "correctOption",
              "explanation",
            ],

            properties: {
              question: {
                type: "string",
              },

              options: {
                type: "object",

                additionalProperties:
                  false,

                required: [
                  "A",
                  "B",
                  "C",
                  "D",
                ],

                properties: {
                  A: {
                    type: "string",
                  },

                  B: {
                    type: "string",
                  },

                  C: {
                    type: "string",
                  },

                  D: {
                    type: "string",
                  },
                },
              },

              correctOption: {
                type: "string",

                enum: [
                  "A",
                  "B",
                  "C",
                  "D",
                ],
              },

              explanation: {
                type: "string",
              },
            },
          },
        },
      },
    },
  },
});


/*
  Validate input
*/

const validateGenerationInput = ({
  topic,
  level,
  language,
  numberOfModules,
  lessonsPerModule,
}) => {
  if (
    !safeString(topic)
  ) {
    throw new Error(
      "Course topic is required"
    );
  }

  if (
    safeString(topic).length <
    2
  ) {
    throw new Error(
      "Course topic must contain at least 2 characters"
    );
  }

  if (
    !Number.isInteger(
      numberOfModules
    ) ||
    numberOfModules < 1 ||
    numberOfModules > 8
  ) {
    throw new Error(
      "Number of modules must be between 1 and 8"
    );
  }

  if (
    !Number.isInteger(
      lessonsPerModule
    ) ||
    lessonsPerModule < 1 ||
    lessonsPerModule > 6
  ) {
    throw new Error(
      "Lessons per module must be between 1 and 6"
    );
  }

  if (
    !safeString(language)
  ) {
    throw new Error(
      "Course language is required"
    );
  }

  if (
    ![
      "Beginner",
      "Intermediate",
      "Advanced",
    ].includes(
      normalizeLevel(level)
    )
  ) {
    throw new Error(
      "Invalid course level"
    );
  }
};


/*
  Generate course outline
*/

const generateCourseOutline =
  async ({
    topic,
    level,
    language,
    numberOfModules,
    lessonsPerModule,
  }) => {
    const prompt = `
You are an expert curriculum designer for an online learning platform named SkillVerse.

Create only the high-level outline for a complete course.

Course information:
Topic: ${topic}
Difficulty level: ${level}
Language: ${language}
Number of modules: ${numberOfModules}
Lessons per module: ${lessonsPerModule}

Requirements:

1. Write all user-facing text in ${language}.
2. Create exactly ${numberOfModules} modules.
3. Arrange modules from foundational concepts to advanced practical concepts.
4. Do not generate lessons or quizzes in this response.
5. Module descriptions should be concise.
6. estimatedDuration must be a readable value such as "2 Hours" or "1 Week".
7. Return only valid JSON matching the supplied schema.
8. Do not include markdown or triple backticks.
9. The course title must clearly represent the topic.
10. The category must be a short category such as Programming, Design, Business, Science or Personal Development.
`;

    const outline =
      await generateStructuredJson(
        {
          prompt,

          responseSchema:
            createOutlineSchema(
              numberOfModules
            ),

          responseName:
            "Gemini course outline",

          maxOutputTokens:
            4096,

          temperature:
            0.15,
        }
      );

    if (
      !Array.isArray(
        outline.modules
      ) ||
      outline.modules.length !==
        numberOfModules
    ) {
      throw new Error(
        `Gemini generated ${
          Array.isArray(
            outline.modules
          )
            ? outline.modules
                .length
            : 0
        } modules instead of ${numberOfModules}`
      );
    }

    return outline;
  };


/*
  Generate one complete module
*/

const generateCompleteModule =
  async ({
    topic,
    courseTitle,
    courseDescription,
    level,
    language,
    moduleOutline,
    moduleIndex,
    numberOfModules,
    lessonsPerModule,
    previousModuleTitles,
  }) => {
    const previousModulesText =
      previousModuleTitles.length >
      0
        ? previousModuleTitles.join(
            ", "
          )
        : "None";

    const prompt = `
You are creating module ${
      moduleIndex + 1
    } of ${numberOfModules} for a SkillVerse course.

Course topic:
${topic}

Course title:
${courseTitle}

Course description:
${courseDescription}

Difficulty level:
${level}

Course language:
${language}

Current module:
${moduleOutline.title}

Current module description:
${moduleOutline.description}

Current module estimated duration:
${moduleOutline.estimatedDuration}

Previous modules:
${previousModulesText}

Create the complete content for this module.

Requirements:

1. Write all user-facing content in ${language}.
2. Create exactly ${lessonsPerModule} lessons.
3. Every lesson must teach a different concept.
4. Arrange lessons in a logical learning order.
5. Each lesson content should be detailed but concise, approximately 250 to 450 words.
6. Avoid markdown headings, markdown tables and triple backticks inside lesson content.
7. lessonType must be video, article, code or project.
8. durationMinutes must be between 5 and 90.
9. youtubeSearchQuery must be a useful YouTube search phrase, not a URL.
10. For programming lessons, include a short complete code example.
11. For non-programming lessons, codeLanguage and codeExample must be empty strings.
12. Every lesson must contain a practical task.
13. Every lesson must contain a concise summary.
14. Create exactly one quiz.
15. The quiz must contain exactly 5 questions.
16. Each quiz question must have exactly four options: A, B, C and D.
17. correctOption must contain only A, B, C or D.
18. Every question must include an explanation.
19. Quiz questions must test concepts from this module only.
20. Do not repeat content from previous modules.
21. Return only valid JSON matching the supplied schema.
22. Do not include markdown or triple backticks.
`;

    const generatedModule =
      await generateStructuredJson(
        {
          prompt,

          responseSchema:
            createModuleSchema(
              lessonsPerModule
            ),

          responseName:
            `Gemini module ${
              moduleIndex + 1
            }`,

          maxOutputTokens:
            8192,

          temperature:
            0.2,
        }
      );

    validateGeneratedModule(
      generatedModule,
      lessonsPerModule,
      moduleIndex
    );

    return generatedModule;
  };


/*
  Validate generated module
*/

const validateGeneratedModule = (
  generatedModule,
  expectedLessons,
  moduleIndex
) => {
  if (
    !generatedModule ||
    typeof generatedModule !==
      "object"
  ) {
    throw new Error(
      `Generated module ${
        moduleIndex + 1
      } is invalid`
    );
  }

  if (
    !safeString(
      generatedModule.title
    )
  ) {
    throw new Error(
      `Generated module ${
        moduleIndex + 1
      } title is missing`
    );
  }

  if (
    !Array.isArray(
      generatedModule.lessons
    )
  ) {
    throw new Error(
      `Lessons are missing in module ${
        moduleIndex + 1
      }`
    );
  }

  if (
    generatedModule.lessons
      .length !==
    expectedLessons
  ) {
    throw new Error(
      `Module ${
        moduleIndex + 1
      } contains ${
        generatedModule.lessons
          .length
      } lessons instead of ${expectedLessons}`
    );
  }

  generatedModule.lessons.forEach(
    (
      lesson,
      lessonIndex
    ) => {
      if (
        !safeString(
          lesson.title
        )
      ) {
        throw new Error(
          `Lesson ${
            lessonIndex + 1
          } title is missing in module ${
            moduleIndex + 1
          }`
        );
      }

      if (
        !safeString(
          lesson.content
        )
      ) {
        throw new Error(
          `Lesson ${
            lessonIndex + 1
          } content is missing in module ${
            moduleIndex + 1
          }`
        );
      }
    }
  );

  if (
    !generatedModule.quiz ||
    !Array.isArray(
      generatedModule.quiz
        .questions
    )
  ) {
    throw new Error(
      `Quiz is missing in module ${
        moduleIndex + 1
      }`
    );
  }

  if (
    generatedModule.quiz
      .questions.length !== 5
  ) {
    throw new Error(
      `Module ${
        moduleIndex + 1
      } quiz must contain exactly 5 questions`
    );
  }

  generatedModule.quiz.questions.forEach(
    (
      question,
      questionIndex
    ) => {
      if (
        !safeString(
          question.question
        )
      ) {
        throw new Error(
          `Quiz question ${
            questionIndex + 1
          } is missing in module ${
            moduleIndex + 1
          }`
        );
      }

      const options =
        question.options;

      if (
        !options ||
        !safeString(options.A) ||
        !safeString(options.B) ||
        !safeString(options.C) ||
        !safeString(options.D)
      ) {
        throw new Error(
          `Options are incomplete for question ${
            questionIndex + 1
          } in module ${
            moduleIndex + 1
          }`
        );
      }

      const correctOption =
        safeString(
          question.correctOption
        ).toUpperCase();

      if (
        ![
          "A",
          "B",
          "C",
          "D",
        ].includes(
          correctOption
        )
      ) {
        throw new Error(
          `Correct option is invalid for question ${
            questionIndex + 1
          } in module ${
            moduleIndex + 1
          }`
        );
      }
    }
  );
};


/*
  Normalize one generated module
*/

const normalizeGeneratedModule = (
  generatedModule,
  moduleOutline
) => ({
  title:
    safeString(
      generatedModule.title,
      moduleOutline.title
    ),

  description:
    safeString(
      generatedModule.description,
      moduleOutline.description
    ),

  estimatedDuration:
    safeString(
      generatedModule
        .estimatedDuration,
      moduleOutline
        .estimatedDuration ||
        "1 Week"
    ),

  lessons:
    generatedModule.lessons.map(
      (lesson) => ({
        title:
          safeString(
            lesson.title,
            "Untitled Lesson"
          ),

        description:
          safeString(
            lesson.description
          ),

        content:
          safeString(
            lesson.content
          ),

        lessonType:
          normalizeLessonType(
            lesson.lessonType
          ),

        durationMinutes:
          normalizePositiveNumber(
            lesson.durationMinutes,
            15
          ),

        youtubeVideoId:
          null,

        youtubeVideoUrl:
          null,

        youtubeSearchQuery:
          safeString(
            lesson.youtubeSearchQuery,
            `${safeString(
              lesson.title,
              moduleOutline.title
            )} tutorial`
          ),

        codeLanguage:
          safeString(
            lesson.codeLanguage
          ) || null,

        codeExample:
          safeString(
            lesson.codeExample
          ) || null,

        practiceTask:
          safeString(
            lesson.practiceTask
          ),

        summary:
          safeString(
            lesson.summary
          ),
      })
    ),

  quiz: {
    title:
      safeString(
        generatedModule.quiz
          .title,
        `${moduleOutline.title} Quiz`
      ),

    description:
      safeString(
        generatedModule.quiz
          .description
      ),

    passingPercentage:
      normalizePercentage(
        generatedModule.quiz
          .passingPercentage
      ),

    timeLimitMinutes:
      normalizePositiveNumber(
        generatedModule.quiz
          .timeLimitMinutes,
        10
      ),

    questions:
      generatedModule.quiz
        .questions.map(
          (question) => ({
            question:
              safeString(
                question.question
              ),

            options: {
              A:
                safeString(
                  question.options
                    .A
                ),

              B:
                safeString(
                  question.options
                    .B
                ),

              C:
                safeString(
                  question.options
                    .C
                ),

              D:
                safeString(
                  question.options
                    .D
                ),
            },

            correctOption:
              safeString(
                question.correctOption,
                "A"
              ).toUpperCase(),

            explanation:
              safeString(
                question.explanation
              ),
          })
        ),
  },
});


/*
  Main course generation service
*/

const generateCourseWithGemini =
  async ({
    topic,
    level = "Beginner",
    language = "English",
    numberOfModules = 4,
    lessonsPerModule = 3,
  }) => {
    const normalizedInput = {
      topic:
        safeString(topic),

      level:
        normalizeLevel(level),

      language:
        safeString(
          language,
          "English"
        ),

      numberOfModules:
        Number(
          numberOfModules
        ),

      lessonsPerModule:
        Number(
          lessonsPerModule
        ),
    };

    validateGenerationInput(
      normalizedInput
    );

    try {
      console.log(
        `🤖 Generating course outline: ${normalizedInput.topic}`
      );

      const outline =
        await generateCourseOutline(
          normalizedInput
        );

      const generatedModules =
        [];

      for (
        let moduleIndex = 0;
        moduleIndex <
        outline.modules.length;
        moduleIndex += 1
      ) {
        const moduleOutline =
          outline.modules[
            moduleIndex
          ];

        console.log(
          `🤖 Generating module ${
            moduleIndex + 1
          }/${outline.modules.length}: ${moduleOutline.title}`
        );

        const previousModuleTitles =
          generatedModules.map(
            (generatedModule) =>
              generatedModule.title
          );

        const generatedModule =
          await generateCompleteModule(
            {
              topic:
                normalizedInput.topic,

              courseTitle:
                outline.title,

              courseDescription:
                outline.description,

              level:
                normalizedInput.level,

              language:
                normalizedInput.language,

              moduleOutline,

              moduleIndex,

              numberOfModules:
                normalizedInput
                  .numberOfModules,

              lessonsPerModule:
                normalizedInput
                  .lessonsPerModule,

              previousModuleTitles,
            }
          );

        generatedModules.push(
          normalizeGeneratedModule(
            generatedModule,
            moduleOutline
          )
        );
      }

      if (
        generatedModules.length !==
        normalizedInput
          .numberOfModules
      ) {
        throw new Error(
          "Not all course modules were generated"
        );
      }

      console.log(
        `✅ Course generation completed: ${outline.title}`
      );

      return {
        title:
          safeString(
            outline.title,
            `${normalizedInput.topic} Complete Course`
          ),

        description:
          safeString(
            outline.description,
            `Learn ${normalizedInput.topic} from ${normalizedInput.level} level.`
          ),

        category:
          safeString(
            outline.category,
            "Education"
          ),

        level:
          normalizeLevel(
            outline.level ||
              normalizedInput.level
          ),

        language:
          safeString(
            outline.language,
            normalizedInput.language
          ),

        estimatedDuration:
          safeString(
            outline.estimatedDuration,
            "Self-paced"
          ),

        status:
          "published",

        generatedByAi:
          true,

        modules:
          generatedModules,
      };
    } catch (error) {
      console.error(
        "AI Course Generation Error:",
        error
      );

      if (
        safeString(
          error.message
        ).toLowerCase()
          .includes(
            "incomplete"
          )
      ) {
        throw new Error(
          "Gemini could not complete one part of the course. Please generate the course again."
        );
      }

      throw error;
    }
  };


module.exports = {
  generateCourseWithGemini,
};