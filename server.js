const express = require(
  "express"
);

const cors = require(
  "cors"
);

const dotenv = require(
  "dotenv"
);

const helmet = require(
  "helmet"
);

const morgan = require(
  "morgan"
);

const cookieParser = require(
  "cookie-parser"
);

dotenv.config();

const {
  connectDatabase,
} = require(
  "./config/db"
);

const authRoutes = require(
  "./routes/authRoutes"
);

const aiRoutes = require(
  "./routes/aiRoutes"
);

const aiTutorRoutes = require(
  "./routes/aiTutorRoutes"
);

const courseRoutes = require(
  "./routes/courseRoutes"
);

const lessonRoutes = require(
  "./routes/lessonRoutes"
);

const progressRoutes = require(
  "./routes/progressRoutes"
);

const quizRoutes = require(
  "./routes/quizRoutes"
);

const app = express();

const PORT =
  Number(
    process.env.PORT ||
      5000
  );

app.use(
  helmet()
);

app.use(
  cors({
    origin:
      process.env
        .FRONTEND_URL ||
      "http://localhost:5173",

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(
  morgan("dev")
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

app.use(
  cookieParser()
);

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.status(200).json({
      success: true,

      message:
        "SkillVerse backend is running",
    });
  }
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.use(
  "/api/ai-tutor",
  aiTutorRoutes
);

app.use(
  "/api/courses",
  courseRoutes
);

app.use(
  "/api/lessons",
  lessonRoutes
);

app.use(
  "/api/progress",
  progressRoutes
);

app.use(
  "/api/quizzes",
  quizRoutes
);

app.use(
  (
    req,
    res
  ) => {
    res.status(404).json({
      success: false,

      message:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Global Server Error:",
      error
    );

    res
      .status(
        error.status ||
          500
      )
      .json({
        success: false,

        message:
          error.message ||
          "Internal server error",
      });
  }
);

const startServer =
  async () => {
    try {
      await connectDatabase();

      app.listen(
        PORT,
        () => {
          console.log(
            `🚀 Server running on port ${PORT}`
          );

          console.log(
            `🔗 API URL: http://localhost:${PORT}`
          );
        }
      );
    } catch (error) {
      console.error(
        "❌ Server Startup Error:",
        error
      );

      process.exit(1);
    }
  };

startServer();