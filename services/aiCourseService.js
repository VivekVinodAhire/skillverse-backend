const ai = require("../config/gemini");

/*
  AI configuration
*/

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.5-flash";

const MAX_RETRIES = Number(
  process.env.GEMINI_MAX_RETRIES || 3
);

const RETRY_DELAY_MS = Number(
  process.env.GEMINI_RETRY_DELAY_MS ||
    5000
);

const GEMINI_TIMEOUT_MS = Number(
  process.env.GEMINI_TIMEOUT_MS ||
    240000
);

/*
  Helpers
*/

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

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

const normalizePercentage = (
  value
) => {
  const percentage =
    Number(value);

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
      `${responseName} JSON parse error:`,
      error.message
    );

    console.error(
      `${responseName} response ending:`,
      cleanedResponse.slice(
        -1000
      )
    );

    throw new Error(
      `${responseName} returned incomplete JSON`
    );
  }
};

const getErrorDetails = (
  error
) => {
  const message =
    safeString(
      error?.message
    ).toLowerCase();

  const causeMessage =
    safeString(
      error?.cause?.message
    ).toLowerCase();

  const code =
    safeString(
      error?.code ||
        error?.cause?.code
    ).toUpperCase();

  const status = Number(
    error?.status ||
      error?.response?.status ||
      0
  );

  return {
    message:
      `${message} ${causeMessage}`.trim(),

    code,

    status,
  };
};

const isRetryableError = (
  error
) => {
  const {
    message,
    code,
    status,
  } = getErrorDetails(error);

  if (
    [
      408,
      409,
      429,
      500,
      502,
      503,
      504,
    ].includes(status)
  ) {
    return true;
  }

  if (
    [
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENETUNREACH",
      "EAI_AGAIN",
    ].includes(code)
  ) {
    return true;
  }

  return (
    message.includes(
      "fetch failed"
    ) ||
    message.includes(
      "headers timeout"
    ) ||
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "incomplete"
    ) ||
    message.includes(
      "empty response"
    ) ||
    message.includes(
      "temporarily unavailable"
    ) ||
    message.includes(
      "resource exhausted"
    ) ||
    message.includes(
      "rate limit"
    ) ||
    message.includes(
      "overloaded"
    )
  );
};

const getFriendlyAiError = (
  error
) => {
  const {
    message,
    code,
    status,
  } = getErrorDetails(error);

  if (
    code.includes(
      "TIMEOUT"
    ) ||
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "fetch failed"
    )
  ) {
    return new Error(
      "Gemini took too long to respond. Your saved progress is safe and generation can be resumed."
    );
  }

  if (
    status === 429 ||
    message.includes(
      "resource exhausted"
    ) ||
    message.includes(
      "rate limit"
    )
  ) {
    return new Error(
      "Gemini request limit was reached. Please resume the generation after a short wait."
    );
  }

  if (
    message.includes(
      "api key"
    )
  ) {
    return new Error(
      "The Gemini API key is missing or invalid."
    );
  }

  return error;
};

/*
  Structured Gemini request with retry
*/

const generateStructuredJson =
  async ({
    prompt,
    responseSchema,
    responseName,
    maxOutputTokens = 4096,
    temperature = 0.2,
    onRetry,
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

                httpOptions: {
                  timeout:
                    GEMINI_TIMEOUT_MS,
                },
              },
            }
          );

        if (
          !response?.text
        ) {
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
          error
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

        const retryDelay =
          RETRY_DELAY_MS *
          attempt;

        if (
          typeof onRetry ===
          "function"
        ) {
          await onRetry({
            attempt,
            maxAttempts:
              MAX_RETRIES,
            retryDelay,
            error,
          });
        }

        await wait(
          retryDelay
        );
      }
    }

    throw getFriendlyAiError(
      lastError
    );
  };

/*
  JSON schemas
*/

const createOutlineSchema = (
  numberOfModules
) => ({
  type: "object",

  additionalProperties:
    false,

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

const createModuleSchema = (
  lessonsPerModule
) => ({
  type: "object",

  additionalProperties:
    false,

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
  Validation
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
  Outline generation
*/

const generateCourseOutline =
  async ({
    topic,
    level,
    language,
    numberOfModules,
    lessonsPerModule,
    onRetry,
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

    const prompt = `
You are an expert curriculum designer for an online learning platform named SkillVerse.

Create only a high-level course outline.

Course information:
Topic: ${normalizedInput.topic}
Difficulty: ${normalizedInput.level}
Language: ${normalizedInput.language}
Number of modules: ${normalizedInput.numberOfModules}
Lessons per module: ${normalizedInput.lessonsPerModule}

Requirements:

1. Write all user-facing text in ${normalizedInput.language}.
2. Create exactly ${normalizedInput.numberOfModules} modules.
3. Arrange modules from beginner foundations to practical advanced concepts.
4. Do not generate complete lessons or quizzes in this response.
5. Keep module descriptions concise.
6. Use readable estimated durations.
7. Return only JSON matching the schema.
8. Do not include markdown or triple backticks.
9. The course title must clearly describe ${normalizedInput.topic}.
10. Use a short and accurate course category.
`;

    const outline =
      await generateStructuredJson({
        prompt,

        responseSchema:
          createOutlineSchema(
            normalizedInput.numberOfModules
          ),

        responseName:
          "Gemini course outline",

        maxOutputTokens:
          2048,

        temperature:
          0.15,

        onRetry,
      });

    if (
      !Array.isArray(
        outline.modules
      ) ||
      outline.modules.length !==
        normalizedInput.numberOfModules
    ) {
      throw new Error(
        `Gemini generated ${
          Array.isArray(
            outline.modules
          )
            ? outline.modules
                .length
            : 0
        } modules instead of ${normalizedInput.numberOfModules}`
      );
    }

    return {
      title:
        safeString(
          outline.title,
          `${normalizedInput.topic} Complete Course`
        ),

      description:
        safeString(
          outline.description,
          `Learn ${normalizedInput.topic} through a complete structured course.`
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

      modules:
        outline.modules.map(
          (
            module,
            index
          ) => ({
            title:
              safeString(
                module.title,
                `Module ${index + 1}`
              ),

            description:
              safeString(
                module.description
              ),

            estimatedDuration:
              safeString(
                module.estimatedDuration,
                "1 Week"
              ),
          })
        ),
    };
  };

/*
  Module validation
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
      `Module ${
        moduleIndex + 1
      } title is missing`
    );
  }

  if (
    !Array.isArray(
      generatedModule.lessons
    ) ||
    generatedModule.lessons
      .length !==
      expectedLessons
  ) {
    throw new Error(
      `Module ${
        moduleIndex + 1
      } must contain exactly ${expectedLessons} lessons`
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
        ) ||
        !safeString(
          lesson.content
        )
      ) {
        throw new Error(
          `Lesson ${
            lessonIndex + 1
          } is incomplete in module ${
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
    ) ||
    generatedModule.quiz
      .questions.length !== 5
  ) {
    throw new Error(
      `Module ${
        moduleIndex + 1
      } quiz must contain exactly 5 questions`
    );
  }
};

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
                    ?.A
                ),

              B:
                safeString(
                  question.options
                    ?.B
                ),

              C:
                safeString(
                  question.options
                    ?.C
                ),

              D:
                safeString(
                  question.options
                    ?.D
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
    previousModuleTitles = [],
    onRetry,
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
    } of ${numberOfModules} for SkillVerse.

Course topic:
${topic}

Course title:
${courseTitle}

Course description:
${courseDescription}

Difficulty:
${level}

Language:
${language}

Current module:
${moduleOutline.title}

Module description:
${moduleOutline.description}

Estimated duration:
${moduleOutline.estimatedDuration}

Previous modules:
${previousModulesText}

Requirements:

1. Write all user-facing content in ${language}.
2. Create exactly ${lessonsPerModule} lessons.
3. Every lesson must teach a different concept.
4. Arrange lessons in a logical order.
5. Each lesson content must be approximately 120 to 180 words.
6. Avoid markdown tables and triple backticks.
7. lessonType must be video, article, code or project.
8. durationMinutes must be between 5 and 90.
9. youtubeSearchQuery must be a search phrase, not a URL.
10. Programming lessons should include a short working code example.
11. Non-programming lessons should use empty code fields.
12. Every lesson needs a practical task and summary.
13. Create exactly one module quiz.
14. The quiz must contain exactly 5 questions.
15. Every question must contain A, B, C and D options.
16. correctOption must be A, B, C or D.
17. Every question needs a concise explanation.
18. Do not repeat concepts from previous modules.
19. Return only JSON matching the schema.
`;

    const generatedModule =
      await generateStructuredJson({
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
          4096,

        temperature:
          0.2,

        onRetry,
      });

    validateGeneratedModule(
      generatedModule,
      lessonsPerModule,
      moduleIndex
    );

    return normalizeGeneratedModule(
      generatedModule,
      moduleOutline
    );
  };

/*
  Backward-compatible complete generation
*/

const generateCourseWithGemini =
  async ({
    topic,
    level = "Beginner",
    language = "English",
    numberOfModules = 4,
    lessonsPerModule = 3,
    completedModules = [],
    onProgress,
    onModuleGenerated,
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

    const reportProgress =
      async (progressData) => {
        if (
          typeof onProgress ===
          "function"
        ) {
          await onProgress(
            progressData
          );
        }
      };

    try {
      await reportProgress({
        stage:
          "outline",

        message:
          "Creating the course roadmap",

        percentage: 5,
      });

      const outline =
        await generateCourseOutline({
          ...normalizedInput,

          onRetry:
            async ({
              attempt,
              maxAttempts,
            }) => {
              await reportProgress({
                stage:
                  "outline_retry",

                message:
                  `Retrying course roadmap (${attempt}/${maxAttempts})`,

                percentage: 5,
              });
            },
        });

      const generatedModules = [
        ...completedModules,
      ];

      const completedModuleOrders =
        new Set(
          completedModules.map(
            (module) =>
              Number(
                module.moduleOrder
              )
          )
        );

      for (
        let moduleIndex = 0;
        moduleIndex <
        outline.modules.length;
        moduleIndex += 1
      ) {
        const moduleOrder =
          moduleIndex + 1;

        if (
          completedModuleOrders.has(
            moduleOrder
          )
        ) {
          continue;
        }

        const moduleOutline =
          outline.modules[
            moduleIndex
          ];

        await reportProgress({
          stage:
            "module",

          moduleOrder,

          totalModules:
            outline.modules.length,

          message:
            `Generating Module ${moduleOrder} of ${outline.modules.length}: ${moduleOutline.title}`,

          percentage:
            Math.min(
              90,
              10 +
                Math.round(
                  (moduleIndex /
                    outline.modules
                      .length) *
                    80
                )
            ),
        });

        const previousModuleTitles =
          generatedModules.map(
            (module) =>
              module.title
          );

        const generatedModule =
          await generateCompleteModule({
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
              outline.modules.length,

            lessonsPerModule:
              normalizedInput.lessonsPerModule,

            previousModuleTitles,

            onRetry:
              async ({
                attempt,
                maxAttempts,
              }) => {
                await reportProgress({
                  stage:
                    "module_retry",

                  moduleOrder,

                  totalModules:
                    outline.modules
                      .length,

                  message:
                    `Retrying Module ${moduleOrder} (${attempt}/${maxAttempts})`,

                  percentage:
                    Math.min(
                      90,
                      10 +
                        Math.round(
                          (moduleIndex /
                            outline.modules
                              .length) *
                            80
                        )
                    ),
                });
              },
          });

        const moduleWithOrder = {
          ...generatedModule,
          moduleOrder,
        };

        generatedModules.push(
          moduleWithOrder
        );

        if (
          typeof onModuleGenerated ===
          "function"
        ) {
          await onModuleGenerated(
            moduleWithOrder
          );
        }

        await reportProgress({
          stage:
            "module_saved",

          moduleOrder,

          totalModules:
            outline.modules.length,

          message:
            `Module ${moduleOrder} of ${outline.modules.length} saved successfully`,

          percentage:
            Math.min(
              95,
              10 +
                Math.round(
                  (moduleOrder /
                    outline.modules
                      .length) *
                    80
                )
            ),
        });
      }

      const sortedModules =
        generatedModules
          .sort(
            (first, second) =>
              Number(
                first.moduleOrder
              ) -
              Number(
                second.moduleOrder
              )
          )
          .map(
            ({
              moduleOrder,
              ...module
            }) => module
          );

      await reportProgress({
        stage:
          "completed",

        message:
          "Course generated successfully",

        percentage: 100,
      });

      return {
        title:
          outline.title,

        description:
          outline.description,

        category:
          outline.category,

        level:
          outline.level,

        language:
          outline.language,

        estimatedDuration:
          outline.estimatedDuration,

        status:
          "published",

        generatedByAi:
          true,

        modules:
          sortedModules,
      };
    } catch (error) {
      console.error(
        "AI Course Generation Error:",
        error
      );

      throw getFriendlyAiError(
        error
      );
    }
  };

module.exports = {
  generateCourseOutline,
  generateCompleteModule,
  generateCourseWithGemini,
};