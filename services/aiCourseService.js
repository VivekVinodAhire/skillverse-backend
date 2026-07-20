const ai = require(
  "../config/gemini"
);

/*
  Stable model priority.

  Railway Variables मधून GEMINI_MODELS दिल्यास
  त्याला priority मिळेल.

  Example:
  GEMINI_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite
*/

const configuredModels =
  String(
    process.env.GEMINI_MODELS ||
      process.env.GEMINI_MODEL ||
      ""
  )
    .split(",")
    .map((model) =>
      model.trim()
    )
    .filter(Boolean);

const GEMINI_MODELS = [
  ...configuredModels,
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
].filter(
  (
    model,
    index,
    models
  ) =>
    models.indexOf(model) ===
    index
);

const MAX_RETRIES_PER_MODEL =
  Math.max(
    1,
    Number(
      process.env
        .GEMINI_MAX_RETRIES ||
        3
    )
  );

const RETRY_BASE_DELAY_MS =
  Math.max(
    1000,
    Number(
      process.env
        .GEMINI_RETRY_DELAY_MS ||
        5000
    )
  );

const GEMINI_TIMEOUT_MS =
  Math.max(
    30000,
    Number(
      process.env
        .GEMINI_TIMEOUT_MS ||
        240000
    )
  );

/*
  Helpers
*/

const wait = (
  milliseconds
) =>
  new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds
    );
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

const normalizeLevel = (
  value
) => {
  const allowedLevels = [
    "Beginner",
    "Intermediate",
    "Advanced",
  ];

  const normalized =
    safeString(
      value,
      "Beginner"
    ).toLowerCase();

  return (
    allowedLevels.find(
      (level) =>
        level.toLowerCase() ===
        normalized
    ) ||
    "Beginner"
  );
};

const normalizeLessonType = (
  value
) => {
  const allowedTypes = [
    "video",
    "article",
    "code",
    "project",
  ];

  const normalized =
    safeString(
      value,
      "article"
    ).toLowerCase();

  return allowedTypes.includes(
    normalized
  )
    ? normalized
    : "article";
};

const normalizePositiveInteger = (
  value,
  fallback
) => {
  const number =
    Number(value);

  if (
    Number.isInteger(number) &&
    number > 0
  ) {
    return number;
  }

  return fallback;
};

const normalizePercentage = (
  value,
  fallback = 60
) => {
  const percentage =
    Number(value);

  if (
    Number.isFinite(
      percentage
    ) &&
    percentage >= 1 &&
    percentage <= 100
  ) {
    return Math.round(
      percentage
    );
  }

  return fallback;
};

const cleanJsonResponse = (
  value
) => {
  let text =
    safeString(value)
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

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if (
    start >= 0 &&
    end > start
  ) {
    text =
      text.slice(
        start,
        end + 1
      );
  }

  return text;
};

const parseJsonResponse = (
  responseText,
  responseName
) => {
  const cleanedText =
    cleanJsonResponse(
      responseText
    );

  if (!cleanedText) {
    throw new Error(
      `${responseName} returned an empty response`
    );
  }

  try {
    return JSON.parse(
      cleanedText
    );
  } catch (error) {
    console.error(
      `${responseName} JSON parse failed:`,
      error.message
    );

    console.error(
      `${responseName} response ending:`,
      cleanedText.slice(
        -800
      )
    );

    throw new Error(
      `${responseName} returned incomplete JSON`
    );
  }
};

const getErrorInformation = (
  error
) => {
  const status =
    Number(
      error?.status ||
        error?.response?.status ||
        error?.cause?.status ||
        0
    );

  const code =
    safeString(
      error?.code ||
        error?.cause?.code
    ).toUpperCase();

  const message =
    [
      error?.message,
      error?.cause?.message,
      error?.response?.data
        ?.message,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  return {
    status,
    code,
    message,
  };
};

const isRetryableError = (
  error
) => {
  const {
    status,
    code,
    message,
  } =
    getErrorInformation(
      error
    );

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
      "high demand"
    ) ||
    message.includes(
      "unavailable"
    ) ||
    message.includes(
      "resource exhausted"
    ) ||
    message.includes(
      "rate limit"
    ) ||
    message.includes(
      "overloaded"
    ) ||
    message.includes(
      "fetch failed"
    ) ||
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "temporarily"
    ) ||
    message.includes(
      "incomplete json"
    ) ||
    message.includes(
      "empty response"
    )
  );
};

const getFriendlyAiError = (
  error
) => {
  const {
    status,
    code,
    message,
  } =
    getErrorInformation(
      error
    );

  if (
    status === 503 ||
    message.includes(
      "high demand"
    ) ||
    message.includes(
      "unavailable"
    )
  ) {
    return new Error(
      "Gemini is currently busy. Your generated modules are safe. Please use Resume Generation after a short wait."
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
      "Gemini request limit was reached. Please wait briefly and resume generation."
    );
  }

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
    message.includes(
      "api key"
    )
  ) {
    return new Error(
      "The Gemini API key is missing, invalid, or not permitted to use this model."
    );
  }

  return new Error(
    safeString(
      error?.message,
      "AI course generation failed"
    )
  );
};

/*
  Exponential backoff:
  5 sec, 10 sec, 20 sec...
  plus small random jitter.
*/

const calculateRetryDelay = (
  attempt
) => {
  const exponentialDelay =
    RETRY_BASE_DELAY_MS *
    2 **
      Math.max(
        0,
        attempt - 1
      );

  const jitter =
    Math.floor(
      Math.random() * 1500
    );

  return Math.min(
    exponentialDelay +
      jitter,
    60000
  );
};

/*
  Structured Gemini request with:
  - model fallback
  - retry
  - timeout
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
    let lastError = null;

    for (
      let modelIndex = 0;
      modelIndex <
      GEMINI_MODELS.length;
      modelIndex += 1
    ) {
      const model =
        GEMINI_MODELS[
          modelIndex
        ];

      for (
        let attempt = 1;
        attempt <=
        MAX_RETRIES_PER_MODEL;
        attempt += 1
      ) {
        try {
          console.log(
            `${responseName}: model=${model}, attempt=${attempt}/${MAX_RETRIES_PER_MODEL}`
          );

          const response =
            await ai.models
              .generateContent({
                model,

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

                    retryOptions: {
                      attempts: 1,
                    },
                  },
                },
              });

          if (
            !response?.text
          ) {
            throw new Error(
              `${responseName} returned an empty response`
            );
          }

          const parsed =
            parseJsonResponse(
              response.text,
              responseName
            );

          console.log(
            `${responseName} completed using ${model}`
          );

          return parsed;
        } catch (error) {
          lastError =
            error;

          const {
            status,
            code,
          } =
            getErrorInformation(
              error
            );

          console.error(
            `${responseName} failed. model=${model}, attempt=${attempt}, status=${status}, code=${code}`,
            error?.message
          );

          const retryable =
            isRetryableError(
              error
            );

          const hasAnotherAttempt =
            attempt <
            MAX_RETRIES_PER_MODEL;

          if (
            retryable &&
            hasAnotherAttempt
          ) {
            const retryDelay =
              calculateRetryDelay(
                attempt
              );

            if (
              typeof onRetry ===
              "function"
            ) {
              await onRetry({
                model,
                attempt,
                maxAttempts:
                  MAX_RETRIES_PER_MODEL,
                retryDelay,
                switchingModel:
                  false,
                error,
              });
            }

            await wait(
              retryDelay
            );

            continue;
          }

          const hasFallbackModel =
            modelIndex <
            GEMINI_MODELS.length -
              1;

          if (
            retryable &&
            hasFallbackModel
          ) {
            const nextModel =
              GEMINI_MODELS[
                modelIndex + 1
              ];

            console.warn(
              `${responseName}: switching from ${model} to ${nextModel}`
            );

            if (
              typeof onRetry ===
              "function"
            ) {
              await onRetry({
                model,
                nextModel,
                attempt,
                maxAttempts:
                  MAX_RETRIES_PER_MODEL,
                retryDelay:
                  RETRY_BASE_DELAY_MS,
                switchingModel:
                  true,
                error,
              });
            }

            await wait(
              RETRY_BASE_DELAY_MS
            );

            break;
          }

          throw getFriendlyAiError(
            error
          );
        }
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
  Input validation
*/

const validateGenerationInput =
  ({
    topic,
    language,
    numberOfModules,
    lessonsPerModule,
  }) => {
    if (
      safeString(topic).length <
      2
    ) {
      throw new Error(
        "Course topic must contain at least 2 characters"
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
  };

/*
  Generate course outline
*/

const generateCourseOutline =
  async ({
    topic,
    level = "Beginner",
    language = "English",
    numberOfModules = 2,
    lessonsPerModule = 2,
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
You are an expert curriculum designer for SkillVerse.

Create only a concise course outline.

Topic: ${normalizedInput.topic}
Difficulty: ${normalizedInput.level}
Language: ${normalizedInput.language}
Modules: ${normalizedInput.numberOfModules}
Lessons per module: ${normalizedInput.lessonsPerModule}

Rules:

1. Write all user-facing content in ${normalizedInput.language}.
2. Create exactly ${normalizedInput.numberOfModules} modules.
3. Arrange modules from foundations to practical concepts.
4. Do not create complete lessons or quizzes yet.
5. Keep descriptions short and clear.
6. Return only valid JSON matching the schema.
7. Do not include markdown or triple backticks.
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
        `Gemini must generate exactly ${normalizedInput.numberOfModules} modules`
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
          `Learn ${normalizedInput.topic} through a structured course.`
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
  Normalize generated module
*/

const normalizeGeneratedModule =
  (
    generatedModule,
    moduleOutline
  ) => {
    const lessons =
      Array.isArray(
        generatedModule.lessons
      )
        ? generatedModule.lessons
        : [];

    const questions =
      Array.isArray(
        generatedModule.quiz
          ?.questions
      )
        ? generatedModule.quiz
            .questions
        : [];

    return {
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
        lessons.map(
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
              normalizePositiveInteger(
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
              ?.title,
            `${moduleOutline.title} Quiz`
          ),

        description:
          safeString(
            generatedModule.quiz
              ?.description
          ),

        passingPercentage:
          normalizePercentage(
            generatedModule.quiz
              ?.passingPercentage
          ),

        timeLimitMinutes:
          normalizePositiveInteger(
            generatedModule.quiz
              ?.timeLimitMinutes,
            10
          ),

        questions:
          questions.map(
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
    };
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
    previousModuleTitles = [],
    onRetry,
  }) => {
    const prompt = `
You are creating Module ${moduleIndex + 1} of ${numberOfModules} for SkillVerse.

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

Previous modules:
${
  previousModuleTitles.length
    ? previousModuleTitles.join(
        ", "
      )
    : "None"
}

Rules:

1. Write all user-facing content in ${language}.
2. Create exactly ${lessonsPerModule} lessons.
3. Each lesson content should be approximately 100 to 160 words.
4. Every lesson must teach a different concept.
5. lessonType must be video, article, code or project.
6. durationMinutes must be between 5 and 90.
7. youtubeSearchQuery must be a search phrase, not a URL.
8. Programming lessons should include a short working code example.
9. Non-programming lessons should use empty code fields.
10. Every lesson needs a practical task and summary.
11. Create exactly 5 quiz questions.
12. Each question must contain A, B, C and D options.
13. correctOption must be A, B, C or D.
14. Avoid repeating previous modules.
15. Return only valid JSON matching the schema.
16. Do not include markdown or triple backticks.
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

    if (
      !Array.isArray(
        generatedModule.lessons
      ) ||
      generatedModule.lessons
        .length !==
        lessonsPerModule
    ) {
      throw new Error(
        `Module ${
          moduleIndex + 1
        } must contain exactly ${lessonsPerModule} lessons`
      );
    }

    if (
      !Array.isArray(
        generatedModule.quiz
          ?.questions
      ) ||
      generatedModule.quiz
        .questions.length !== 5
    ) {
      throw new Error(
        `Module ${
          moduleIndex + 1
        } must contain exactly 5 quiz questions`
      );
    }

    return normalizeGeneratedModule(
      generatedModule,
      moduleOutline
    );
  };

/*
  Backward-compatible complete course generator
*/

const generateCourseWithGemini =
  async ({
    topic,
    level = "Beginner",
    language = "English",
    numberOfModules = 2,
    lessonsPerModule = 2,
    completedModules = [],
    onProgress,
    onModuleGenerated,
  }) => {
    const reportProgress =
      async (
        progressData
      ) => {
        if (
          typeof onProgress ===
          "function"
        ) {
          await onProgress(
            progressData
          );
        }
      };

    const outline =
      await generateCourseOutline({
        topic,
        level,
        language,
        numberOfModules,
        lessonsPerModule,

        onRetry:
          async ({
            attempt,
            maxAttempts,
            model,
            nextModel,
            switchingModel,
          }) => {
            await reportProgress({
              stage:
                "outline_retry",

              percentage: 5,

              message:
                switchingModel
                  ? `Switching AI model from ${model} to ${nextModel}`
                  : `Retrying course roadmap (${attempt}/${maxAttempts})`,
            });
          },
      });

    const generatedModules = [
      ...completedModules,
    ];

    const completedOrders =
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
        completedOrders.has(
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

        percentage:
          Math.min(
            90,
            10 +
              Math.round(
                (
                  moduleIndex /
                  outline.modules
                    .length
                ) *
                  80
              )
          ),

        message:
          `Generating Module ${moduleOrder} of ${outline.modules.length}: ${moduleOutline.title}`,
      });

      const moduleData =
        await generateCompleteModule({
          topic,
          courseTitle:
            outline.title,
          courseDescription:
            outline.description,
          level:
            outline.level,
          language:
            outline.language,
          moduleOutline,
          moduleIndex,
          numberOfModules:
            outline.modules.length,
          lessonsPerModule,
          previousModuleTitles:
            generatedModules.map(
              (module) =>
                module.title
            ),

          onRetry:
            async ({
              attempt,
              maxAttempts,
              model,
              nextModel,
              switchingModel,
            }) => {
              await reportProgress({
                stage:
                  "module_retry",

                moduleOrder,

                totalModules:
                  outline.modules
                    .length,

                message:
                  switchingModel
                    ? `Module ${moduleOrder}: switching from ${model} to ${nextModel}`
                    : `Retrying Module ${moduleOrder} (${attempt}/${maxAttempts})`,
              });
            },
        });

      const orderedModule = {
        ...moduleData,
        moduleOrder,
      };

      generatedModules.push(
        orderedModule
      );

      if (
        typeof onModuleGenerated ===
        "function"
      ) {
        await onModuleGenerated(
          orderedModule
        );
      }
    }

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
        generatedModules
          .sort(
            (
              first,
              second
            ) =>
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
          ),
    };
  };

module.exports = {
  generateCourseOutline,
  generateCompleteModule,
  generateCourseWithGemini,
};