const {
  createCompleteCourse,
  getAllCourses,
  getCompleteCourseById,
  getCoursesByUserId,
  deleteCourseByUserId,
} = require("../models/courseModel");


const {
  generateCourseWithGemini,
} = require("../services/aiCourseService");
/*
  Temporary sample course.

  Step 3 मध्ये हाच data Gemini कडून येईल.
*/

/*
  Gemini AI वापरून complete course generate करणे
  आणि MySQL मध्ये save करणे.
*/

const generateAiCourse = async (
  req,
  res
) => {
  try {
    const {
      topic,
      level = "Beginner",
      language = "English",
      numberOfModules = 4,
      lessonsPerModule = 3,
    } = req.body;

    /*
      Topic validation
    */

    if (
      !topic ||
      typeof topic !== "string" ||
      topic.trim().length < 2
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Please enter a valid course topic",
      });
    }

    /*
      Level validation
    */

    const allowedLevels = [
      "Beginner",
      "Intermediate",
      "Advanced",
    ];

    const normalizedLevel =
      allowedLevels.find(
        (item) =>
          item.toLowerCase() ===
          String(level).toLowerCase()
      );

    if (!normalizedLevel) {
      return res.status(400).json({
        success: false,

        message:
          "Level must be Beginner, Intermediate or Advanced",
      });
    }

    /*
      Modules validation
    */

    const moduleCount = Number(
      numberOfModules
    );

    if (
      !Number.isInteger(moduleCount) ||
      moduleCount < 1 ||
      moduleCount > 8
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Number of modules must be between 1 and 8",
      });
    }

    /*
      Lessons validation
    */

    const lessonCount = Number(
      lessonsPerModule
    );

    if (
      !Number.isInteger(lessonCount) ||
      lessonCount < 1 ||
      lessonCount > 6
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Lessons per module must be between 1 and 6",
      });
    }

    console.log(
      `AI course generation started: ${topic}`
    );

    /*
      Step 1:
      Gemini कडून complete JSON generate कर
    */

    const generatedCourse =
      await generateCourseWithGemini({
        topic: topic.trim(),

        level: normalizedLevel,

        language:
          String(language).trim() ||
          "English",

        numberOfModules: moduleCount,

        lessonsPerModule:
          lessonCount,
      });

    /*
      Step 2:
      Logged-in user implementation नंतर
      req.user.id वापरू.

      सध्या testing साठी null.
    */

    const requestUserId = Number(
  req.user?.id || req.body.userId
);

if (
  !Number.isInteger(requestUserId) ||
  requestUserId <= 0
) {
  return res.status(400).json({
    success: false,
    message:
      "A valid logged-in user ID is required",
  });
}

generatedCourse.userId = requestUserId;
generatedCourse.generatedByAi = true;
generatedCourse.status = "published";

    /*
      Step 3:
      Complete course MySQL मध्ये save कर
    */

    const savedCourse =
      await createCompleteCourse(
        generatedCourse
      );

    console.log(
      `AI course saved successfully. Course ID: ${savedCourse.courseId}`
    );

    return res.status(201).json({
      success: true,

      message:
        "AI course generated and saved successfully",

      data: {
        courseId:
          savedCourse.courseId,

        title:
          generatedCourse.title,

        description:
          generatedCourse.description,

        category:
          generatedCourse.category,

        level:
          generatedCourse.level,

        language:
          generatedCourse.language,

        estimatedDuration:
          generatedCourse
            .estimatedDuration,

        totalModules:
          savedCourse.totalModules,

        totalLessons:
          savedCourse.totalLessons,
      },
    });
  } catch (error) {
    console.error(
      "Generate AI Course Error:",
      error
    );

    let statusCode = 500;

    if (
      error.status === 429 ||
      error.code === 429
    ) {
      statusCode = 429;
    }

    return res.status(statusCode).json({
      success: false,

      message:
        error.message ||
        "Failed to generate AI course",
    });
  }
};

const createSampleCourse = async (
  req,
  res
) => {
  try {
    const sampleCourse = {
      userId: null,

      title:
        "Java Programming Complete Course",

      description:
        "Learn Java programming from beginner to advanced level with lessons, examples, videos and quizzes.",

      category: "Programming",

      level: "Beginner",

      language: "English",

      estimatedDuration: "8 Weeks",

      status: "published",

      generatedByAi: false,

      modules: [
        {
          title: "Introduction to Java",

          description:
            "Understand Java, its features and development environment.",

          estimatedDuration: "1 Week",

          lessons: [
            {
              title: "What is Java?",

              description:
                "Introduction to Java programming language.",

              content:
                "Java is a high-level, object-oriented programming language. It is widely used for web applications, Android applications and enterprise systems.",

              lessonType: "video",

              durationMinutes: 12,

              youtubeSearchQuery:
                "Java programming introduction for beginners",

              codeLanguage: "java",

              codeExample: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello Java");
  }
}`,

              practiceTask:
                "Write a Java program that prints your name.",

              summary:
                "Java is secure, portable and object-oriented.",
            },

            {
              title:
                "Install Java and IntelliJ IDEA",

              description:
                "Install the required software for Java development.",

              content:
                "Install the Java Development Kit and configure an IDE such as IntelliJ IDEA or VS Code.",

              lessonType: "video",

              durationMinutes: 15,

              youtubeSearchQuery:
                "Install Java JDK IntelliJ IDEA Windows",

              practiceTask:
                "Install the JDK and run your first Java program.",

              summary:
                "The JDK is required to compile and run Java programs.",
            },
          ],

          quiz: {
            title:
              "Introduction to Java Quiz",

            description:
              "Test your basic Java knowledge.",

            passingPercentage: 60,

            timeLimitMinutes: 10,

            questions: [
              {
                question:
                  "What type of programming language is Java?",

                options: {
                  A: "Only procedural",
                  B: "Object-oriented",
                  C: "Markup language",
                  D: "Database language",
                },

                correctOption: "B",

                explanation:
                  "Java is primarily an object-oriented programming language.",
              },

              {
                question:
                  "Which tool is required to compile Java code?",

                options: {
                  A: "JDK",
                  B: "MySQL",
                  C: "Chrome",
                  D: "Node.js",
                },

                correctOption: "A",

                explanation:
                  "The Java Development Kit contains the Java compiler.",
              },
            ],
          },
        },

        {
          title:
            "Java Variables and Data Types",

          description:
            "Learn how Java stores and manages data.",

          estimatedDuration: "1 Week",

          lessons: [
            {
              title:
                "Variables in Java",

              description:
                "Understand variables and their syntax.",

              content:
                "A variable is a named memory location used to store data.",

              lessonType: "video",

              durationMinutes: 14,

              youtubeSearchQuery:
                "Java variables tutorial for beginners",

              codeLanguage: "java",

              codeExample: `public class Main {
  public static void main(String[] args) {
    String name = "Darshan";
    int age = 21;

    System.out.println(name);
    System.out.println(age);
  }
}`,

              practiceTask:
                "Create variables for your name, age and college.",

              summary:
                "Variables are used to store values in memory.",
            },

            {
              title:
                "Primitive Data Types",

              description:
                "Learn int, double, char and boolean data types.",

              content:
                "Java primitive types include byte, short, int, long, float, double, char and boolean.",

              lessonType: "article",

              durationMinutes: 18,

              youtubeSearchQuery:
                "Java primitive data types tutorial",

              practiceTask:
                "Create one variable for each primitive data type.",

              summary:
                "Primitive data types store simple values.",
            },
          ],

          quiz: {
            title:
              "Variables and Data Types Quiz",

            description:
              "Test your understanding of variables and data types.",

            passingPercentage: 60,

            timeLimitMinutes: 10,

            questions: [
              {
                question:
                  "Which data type stores whole numbers?",

                options: {
                  A: "String",
                  B: "boolean",
                  C: "int",
                  D: "char",
                },

                correctOption: "C",

                explanation:
                  "The int data type stores whole numbers.",
              },

              {
                question:
                  "Which data type stores true or false?",

                options: {
                  A: "double",
                  B: "boolean",
                  C: "char",
                  D: "long",
                },

                correctOption: "B",

                explanation:
                  "The boolean data type stores true or false values.",
              },
            ],
          },
        },
      ],
    };

    const result =
      await createCompleteCourse(
        sampleCourse
      );

    return res.status(201).json({
      success: true,

      message:
        "Sample course created successfully",

      data: result,
    });
  } catch (error) {
    console.error(
      "Create Course Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to create course",
    });
  }
};


const fetchAllCourses = async (
  req,
  res
) => {
  try {
    const courses =
      await getAllCourses();

    return res.status(200).json({
      success: true,

      total: courses.length,

      courses,
    });
  } catch (error) {
    console.error(
      "Fetch Courses Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to fetch courses",
    });
  }
};


const fetchCourseById = async (
  req,
  res
) => {
  try {
    const courseId = Number(
      req.params.courseId
    );

    if (
      !Number.isInteger(courseId) ||
      courseId <= 0
    ) {
      return res.status(400).json({
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
      return res.status(404).json({
        success: false,

        message: "Course not found",
      });
    }

    return res.status(200).json({
      success: true,

      course,
    });
  } catch (error) {
    console.error(
      "Fetch Course Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to fetch course",
    });
  }
};

/*
  Get logged-in user's courses

  GET /api/courses/my-courses?userId=1
*/

const fetchMyCourses = async (
  req,
  res
) => {
  try {
    const userId = Number(
      req.user?.id || req.query.userId
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid user ID is required",
      });
    }

    const courses =
      await getCoursesByUserId(userId);

    return res.status(200).json({
      success: true,
      total: courses.length,
      courses,
    });
  } catch (error) {
    console.error(
      "Fetch My Courses Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch your courses",
    });
  }
};


/*
  Delete logged-in user's course

  DELETE /api/courses/:courseId?userId=1
*/

const deleteMyCourse = async (
  req,
  res
) => {
  try {
    const courseId = Number(
      req.params.courseId
    );

    const userId = Number(
      req.user?.id ||
        req.query.userId ||
        req.body?.userId
    );

    if (
      !Number.isInteger(courseId) ||
      courseId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid course ID is required",
      });
    }

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid user ID is required",
      });
    }

    const deleted =
      await deleteCourseByUserId({
        courseId,
        userId,
      });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message:
          "Course not found or you cannot delete this course",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Course deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Course Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete course",
    });
  }
};


module.exports = {
  generateAiCourse,
  createSampleCourse,
  fetchAllCourses,
  fetchMyCourses,
  fetchCourseById,
  deleteMyCourse,
};