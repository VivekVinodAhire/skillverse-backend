const {
  generateCourseOutline,
  generateCompleteModule,
} = require(
  "../services/aiCourseService"
);

const {
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
} = require(
  "../models/courseModel"
);

const {
  userExistsById,
} = require(
  "../models/userModel"
);

const runningJobs =
  new Set();

const normalizeUserId = (
  req
) => {
  const userId =
    Number(
      req.user?.id ||
        req.body?.userId ||
        req.query?.userId
    );

  if (
    !Number.isInteger(
      userId
    ) ||
    userId <= 0
  ) {
    return null;
  }

  return userId;
};

const safeString = (
  value,
  fallback = ""
) => {
  const normalizedValue =
    String(
      value ?? ""
    ).trim();

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

  const matchedLevel =
    allowedLevels.find(
      (level) =>
        level.toLowerCase() ===
        safeString(value)
          .toLowerCase()
    );

  return (
    matchedLevel ||
    "Beginner"
  );
};

const runGenerationJob =
  async ({
    jobId,
    userId,
  }) => {
    const runningKey =
      `${userId}:${jobId}`;

    if (
      runningJobs.has(
        runningKey
      )
    ) {
      return;
    }

    runningJobs.add(
      runningKey
    );

    let courseId = null;

    try {
      const job =
        await getGenerationJobById({
          jobId,
          userId,
        });

      if (!job) {
        throw new Error(
          "Generation job was not found"
        );
      }

      courseId =
        Number(
          job.course_id
        ) ||
        null;

      await updateGenerationJob({
        jobId,
        userId,
        status:
          "generating",
        stage:
          "outline",
        progressPercentage:
          Math.max(
            Number(
              job.progress_percentage
            ) ||
              0,
            3
          ),
        progressMessage:
          "Creating the course roadmap",
        errorMessage:
          null,
      });

      let outline =
        job.outline;

      if (!outline) {
        outline =
          await generateCourseOutline({
            topic:
              job.topic,

            level:
              job.level,

            language:
              job.language,

            numberOfModules:
              Number(
                job.number_of_modules
              ),

            lessonsPerModule:
              Number(
                job.lessons_per_module
              ),

            onRetry:
              async ({
                attempt,
                maxAttempts,
              }) => {
                await updateGenerationJob({
                  jobId,
                  userId,
                  status:
                    "generating",
                  stage:
                    "outline_retry",
                  progressPercentage:
                    4,
                  progressMessage:
                    `Retrying course roadmap (${attempt}/${maxAttempts})`,
                });
              },
          });

        await updateGenerationJob({
          jobId,
          userId,
          outline,
          progressPercentage:
            10,
          progressMessage:
            "Course roadmap created",
        });
      }

      if (!courseId) {
        courseId =
          await createCourseDraft({
            userId,
            outline,

            numberOfModules:
              Number(
                job.number_of_modules
              ),

            lessonsPerModule:
              Number(
                job.lessons_per_module
              ),
          });

        await updateGenerationJob({
          jobId,
          userId,
          courseId,
          progressPercentage:
            12,
          progressMessage:
            "Course draft saved",
        });
      }

      const savedModules =
        await getSavedModulesForResume(
          courseId
        );

      const savedOrders =
        new Set(
          savedModules.map(
            (module) =>
              Number(
                module.moduleOrder
              )
          )
        );

      const previousModuleTitles =
        savedModules
          .sort(
            (
              first,
              second
            ) =>
              first.moduleOrder -
              second.moduleOrder
          )
          .map(
            (module) =>
              module.title
          );

      let completedModules =
        savedOrders.size;

      const totalModules =
        Number(
          job.number_of_modules
        );

      const lessonsPerModule =
        Number(
          job.lessons_per_module
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
          savedOrders.has(
            moduleOrder
          )
        ) {
          continue;
        }

        const moduleOutline =
          outline.modules[
            moduleIndex
          ];

        const basePercentage =
          12 +
          Math.round(
            (
              completedModules /
              totalModules
            ) *
              78
          );

        await updateGenerationJob({
          jobId,
          userId,
          courseId,
          status:
            "generating",
          stage:
            "module",
          currentModule:
            moduleOrder,
          completedModules,
          progressPercentage:
            Math.min(
              basePercentage,
              90
            ),
          progressMessage:
            `Generating Module ${moduleOrder} of ${totalModules}: ${moduleOutline.title}`,
        });

        const generatedModule =
          await generateCompleteModule({
            topic:
              job.topic,

            courseTitle:
              outline.title,

            courseDescription:
              outline.description,

            level:
              job.level,

            language:
              job.language,

            moduleOutline,

            moduleIndex,

            numberOfModules:
              totalModules,

            lessonsPerModule,

            previousModuleTitles,

            onRetry:
              async ({
                attempt,
                maxAttempts,
              }) => {
                await updateGenerationJob({
                  jobId,
                  userId,
                  courseId,
                  status:
                    "generating",
                  stage:
                    "module_retry",
                  currentModule:
                    moduleOrder,
                  completedModules,
                  progressPercentage:
                    Math.min(
                      basePercentage,
                      90
                    ),
                  progressMessage:
                    `Retrying Module ${moduleOrder} (${attempt}/${maxAttempts})`,
                });
              },
          });

        await saveGeneratedModule({
          courseId,

          moduleData:
            generatedModule,

          moduleOrder,
        });

        previousModuleTitles.push(
          generatedModule.title
        );

        savedOrders.add(
          moduleOrder
        );

        completedModules += 1;

        const savedPercentage =
          12 +
          Math.round(
            (
              completedModules /
              totalModules
            ) *
              78
          );

        await updateGenerationJob({
          jobId,
          userId,
          courseId,
          status:
            "generating",
          stage:
            "module_saved",
          currentModule:
            moduleOrder,
          completedModules,
          progressPercentage:
            Math.min(
              savedPercentage,
              92
            ),
          progressMessage:
            `Module ${moduleOrder} of ${totalModules} saved successfully`,
        });
      }

      const totalLessons =
        totalModules *
        lessonsPerModule;

      await finalizeGeneratedCourse({
        courseId,
        totalModules,
        totalLessons,
      });

      await updateGenerationJob({
        jobId,
        userId,
        courseId,
        status:
          "completed",
        stage:
          "completed",
        currentModule:
          totalModules,
        completedModules:
          totalModules,
        progressPercentage:
          100,
        progressMessage:
          "Course generated successfully",
        errorMessage:
          null,
        completed:
          true,
      });

      console.log(
        `✅ Course generation completed. Job: ${jobId}, Course: ${courseId}`
      );
    } catch (error) {
      console.error(
        `Course generation job ${jobId} failed:`,
        error
      );

      await updateGenerationJob({
        jobId,
        userId,
        courseId:
          courseId ||
          undefined,
        status:
          "failed",
        stage:
          "failed",
        progressMessage:
          "Course generation paused",
        errorMessage:
          error.message ||
          "Course generation failed",
      }).catch(
        (updateError) => {
          console.error(
            "Failed to update generation job:",
            updateError
          );
        }
      );

      if (courseId) {
        await markCourseGenerationFailed(
          courseId
        ).catch(
          (courseError) => {
            console.error(
              "Failed to update course status:",
              courseError
            );
          }
        );
      }
    } finally {
      runningJobs.delete(
        runningKey
      );
    }
  };

/*
  Start asynchronous generation

  POST /api/courses/generate
*/

const generateAiCourse =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        normalizeUserId(req);

      const topic =
        safeString(
          req.body?.topic
        );

      const level =
        normalizeLevel(
          req.body?.level
        );

      const language =
        safeString(
          req.body?.language,
          "English"
        );

      const numberOfModules =
        Number(
          req.body
            ?.numberOfModules
        );

      const lessonsPerModule =
        Number(
          req.body
            ?.lessonsPerModule
        );

      if (!userId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "A valid user ID is required",
          });
      }

      if (
        !(await userExistsById(
          userId
        ))
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Logged-in user was not found",
          });
      }

      if (
        topic.length < 2
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Course topic must contain at least 2 characters",
          });
      }

      if (
        !Number.isInteger(
          numberOfModules
        ) ||
        numberOfModules <
          1 ||
        numberOfModules >
          8
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Number of modules must be between 1 and 8",
          });
      }

      if (
        !Number.isInteger(
          lessonsPerModule
        ) ||
        lessonsPerModule <
          1 ||
        lessonsPerModule >
          6
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Lessons per module must be between 1 and 6",
          });
      }

      const jobId =
        await createGenerationJob({
          userId,
          topic,
          level,
          language,
          numberOfModules,
          lessonsPerModule,
        });

      setImmediate(() => {
        runGenerationJob({
          jobId,
          userId,
        }).catch(
          (error) => {
            console.error(
              "Background generation error:",
              error
            );
          }
        );
      });

      return res
        .status(202)
        .json({
          success: true,

          message:
            "Course generation started",

          jobId,

          status:
            "queued",

          progressPercentage:
            0,
        });
    } catch (error) {
      console.error(
        "Generate AI Course Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to start course generation",
        });
    }
  };

/*
  Poll generation status

  GET /api/courses/generation/:jobId
*/

const fetchGenerationStatus =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        normalizeUserId(req);

      const jobId =
        Number(
          req.params.jobId
        );

      if (
        !userId ||
        !Number.isInteger(
          jobId
        ) ||
        jobId <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Valid user and generation job IDs are required",
          });
      }

      const job =
        await getGenerationJobById({
          jobId,
          userId,
        });

      if (!job) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Generation job not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          generation: {
            jobId:
              job.id,

            courseId:
              job.course_id,

            status:
              job.status,

            stage:
              job.stage,

            progressPercentage:
              Number(
                job.progress_percentage
              ) ||
              0,

            currentModule:
              Number(
                job.current_module
              ) ||
              0,

            completedModules:
              Number(
                job.completed_modules
              ) ||
              0,

            totalModules:
              Number(
                job.number_of_modules
              ) ||
              0,

            message:
              job.progress_message,

            error:
              job.error_message,

            canResume:
              job.status ===
              "failed",
          },
        });
    } catch (error) {
      console.error(
        "Fetch Generation Status Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to fetch generation status",
        });
    }
  };

/*
  Resume failed generation

  POST /api/courses/generation/:jobId/resume
*/

const resumeCourseGeneration =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        normalizeUserId(req);

      const jobId =
        Number(
          req.params.jobId
        );

      if (
        !userId ||
        !Number.isInteger(
          jobId
        ) ||
        jobId <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Valid user and generation job IDs are required",
          });
      }

      const job =
        await getGenerationJobById({
          jobId,
          userId,
        });

      if (!job) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Generation job not found",
          });
      }

      if (
        job.status ===
        "completed"
      ) {
        return res
          .status(200)
          .json({
            success: true,
            message:
              "Course is already completed",
            jobId,
            courseId:
              job.course_id,
          });
      }

      await updateGenerationJob({
        jobId,
        userId,
        status:
          "queued",
        stage:
          "resuming",
        progressMessage:
          "Resuming course generation",
        errorMessage:
          null,
      });

      setImmediate(() => {
        runGenerationJob({
          jobId,
          userId,
        }).catch(
          (error) => {
            console.error(
              "Resume generation error:",
              error
            );
          }
        );
      });

      return res
        .status(202)
        .json({
          success: true,
          message:
            "Course generation resumed",
          jobId,
          courseId:
            job.course_id,
        });
    } catch (error) {
      console.error(
        "Resume Course Generation Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to resume course generation",
        });
    }
  };

const createSampleCourse =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        normalizeUserId(req);

      if (!userId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "A valid user ID is required",
          });
      }

      const courseData = {
        userId,
        title:
          "SkillVerse Sample Course",
        description:
          "A sample course generated for testing.",
        category:
          "Education",
        level:
          "Beginner",
        language:
          "English",
        estimatedDuration:
          "1 Week",
        generatedByAi:
          false,
        status:
          "published",

        modules: [
          {
            title:
              "Getting Started",
            description:
              "Introduction to the sample course.",
            estimatedDuration:
              "1 Hour",

            lessons: [
              {
                title:
                  "Welcome Lesson",
                description:
                  "Introduction lesson.",
                content:
                  "Welcome to your SkillVerse sample course.",
                lessonType:
                  "article",
                durationMinutes:
                  10,
                youtubeSearchQuery:
                  "SkillVerse learning introduction",
                codeLanguage:
                  null,
                codeExample:
                  null,
                practiceTask:
                  "Explore the course dashboard.",
                summary:
                  "You learned how the sample course works.",
              },
            ],

            quiz: {
              title:
                "Getting Started Quiz",
              description:
                "Sample quiz.",
              passingPercentage:
                60,
              timeLimitMinutes:
                5,

              questions:
                Array.from(
                  {
                    length: 5,
                  },
                  (
                    _,
                    index
                  ) => ({
                    question:
                      `Sample question ${index + 1}?`,

                    options: {
                      A:
                        "Option A",
                      B:
                        "Option B",
                      C:
                        "Option C",
                      D:
                        "Option D",
                    },

                    correctOption:
                      "A",

                    explanation:
                      "Option A is the sample correct answer.",
                  })
                ),
            },
          },
        ],
      };

      const result =
        await createCompleteCourse(
          courseData
        );

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Sample course created",
          ...result,
        });
    } catch (error) {
      console.error(
        "Create Sample Course Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to create sample course",
        });
    }
  };

const fetchAllCourses =
  async (
    req,
    res
  ) => {
    try {
      const courses =
        await getAllCourses();

      return res
        .status(200)
        .json({
          success: true,
          courses,
        });
    } catch (error) {
      console.error(
        "Fetch All Courses Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to fetch courses",
        });
    }
  };

const fetchMyCourses =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        normalizeUserId(req);

      if (!userId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "A valid user ID is required",
          });
      }

      const courses =
        await getCoursesByUserId(
          userId
        );

      return res
        .status(200)
        .json({
          success: true,
          courses,
        });
    } catch (error) {
      console.error(
        "Fetch My Courses Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to fetch your courses",
        });
    }
  };

const fetchCourseById =
  async (
    req,
    res
  ) => {
    try {
      const courseId =
        Number(
          req.params.courseId
        );

      if (
        !Number.isInteger(
          courseId
        ) ||
        courseId <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "A valid course ID is required",
          });
      }

      const course =
        await getCompleteCourseById(
          courseId
        );

      if (!course) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Course not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          course,
        });
    } catch (error) {
      console.error(
        "Fetch Course Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to fetch course",
        });
    }
  };

const deleteMyCourse =
  async (
    req,
    res
  ) => {
    try {
      const courseId =
        Number(
          req.params.courseId
        );

      const userId =
        normalizeUserId(req);

      if (
        !Number.isInteger(
          courseId
        ) ||
        courseId <= 0 ||
        !userId
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Valid course and user IDs are required",
          });
      }

      const deleted =
        await deleteCourseByUserId({
          courseId,
          userId,
        });

      if (!deleted) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Course not found or you do not own it",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Course deleted successfully",
        });
    } catch (error) {
      console.error(
        "Delete Course Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to delete course",
        });
    }
  };

module.exports = {
  generateAiCourse,
  fetchGenerationStatus,
  resumeCourseGeneration,
  createSampleCourse,
  fetchAllCourses,
  fetchMyCourses,
  fetchCourseById,
  deleteMyCourse,
};